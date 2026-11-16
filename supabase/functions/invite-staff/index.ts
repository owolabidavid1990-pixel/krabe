import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Standard CORS headers for frontend requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InviteStaffPayload {
  email: string;
  name?: string;
}

serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration in Edge Function environment.");
    }

    // 2. Extract Authorization header & caller token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Invalid bearer token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Initialize Admin Client (uses service role key)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Verify the caller identity
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Authentication failed. Please sign in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Query the caller's role strictly from public.profile
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profile")
      .select("role, name")
      .eq("id", callerUser.id)
      .single();

    if (profileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: "Could not retrieve caller profile." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. ENFORCE: Strictly Super Admin only
    if (callerProfile.role !== "super admin") {
      return new Response(
        JSON.stringify({ 
          error: "Forbidden: Only Super Admins have permission to invite atelier staff members." 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Parse & validate payload
    const body: InviteStaffPayload = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const name = (body.name || "").trim();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Please provide a valid email address." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Trigger Supabase official email invitation
    // Metadata role is ALWAYS locked strictly to 'admin'
    // This automatically sets `invited_at` on auth.users so handle_new_user() assigns role = 'admin'
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          role: "admin",
          name: name || email.split("@")[0],
          invited_by: callerUser.id,
        },
      }
    );

    if (inviteError) {
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: `Official staff invitation sent to ${email} as admin.`,
        user: inviteData.user,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "An unexpected error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

