import { supabaseAdmin } from "../config/supabase.js";
import { ApiError } from "../utils/errors.js";

export async function register(req, res) {
  // Body already validated by Zod middleware (email, password, fullName)
  const { email, password, fullName } = req.body;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) throw new ApiError(400, error.message);

  await supabaseAdmin.from("profiles").upsert({
    id: data.user.id,
    email,
    full_name: fullName,
  });

  res.status(201).json({ user: data.user });
}

export async function login(req, res) {
  // Body already validated by Zod middleware (email, password)
  const { email, password } = req.body;

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new ApiError(401, error.message);

  res.json({
    user: data.user,
    session: data.session,
  });
}
