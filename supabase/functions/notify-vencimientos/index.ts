import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import webpush from "npm:web-push@3.6.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

webpush.setVapidDetails(
  "mailto:soporte@meta-cero.com",
  "BKaK8L3Kq6oQuuJGZBgb9vfXa10AKIraOFf3OQLgV8YK2x69tFYcXrxRZsxbM1OaUPW291aD1hDXaqyUvhGkhQY",
  "ZaxXYM-4jv-ecVCkn8xvBe1_qQ1lieIuYqR-7R3vs1g"
);

Deno.serve(async (req) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase env vars");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const fechaLocal = new Date(new Date().getTime() - 5 * 60 * 60 * 1000);
    const hoyStr = fechaLocal.toISOString().split("T")[0];

    const { data: cuotasVencidas, error } = await supabaseAdmin
      .from("cuotas")
      .select("*, deudas(user_id, nombre)")
      .eq("fecha", hoyStr)
      .eq("pagada", false);

    if (error) throw new Error("DB Query Error: " + JSON.stringify(error));
    if (!cuotasVencidas || cuotasVencidas.length === 0) {
      return new Response("No hay cuotas vencidas hoy", { status: 200 });
    }

    const porUsuario: Record<string, typeof cuotasVencidas> = {};
    cuotasVencidas.forEach((c) => {
      const uid = c.deudas.user_id;
      if (!porUsuario[uid]) porUsuario[uid] = [];
      porUsuario[uid].push(c);
    });

    const promesasEnvio: Promise<unknown>[] = [];

    for (const [userId, cuotas] of Object.entries(porUsuario)) {
      const { data: subs, error: subsError } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId);

      if (subsError) throw new Error("Sub Query Error: " + JSON.stringify(subsError));

      if (subs && subs.length > 0) {
        const payload = JSON.stringify({
          title: "Meta Cero - Recordatorio",
          body: `Tienes ${cuotas.length} cuota(s) que pagar HOY. Ingresa para revisarlas.`,
          url: "https://meta-cero.com/",
        });

        subs.forEach((sub) => {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              auth: sub.auth_key,
              p256dh: sub.p256dh_key,
            },
          };

          promesasEnvio.push(
            webpush.sendNotification(pushSubscription, payload).catch(async (err: any) => {
              if (err.statusCode === 410) {
                await supabaseAdmin
                  .from("push_subscriptions")
                  .delete()
                  .eq("id", sub.id);
              } else {
                console.error("Push Error", err);
              }
            })
          );
        });
      }
    }

    await Promise.all(promesasEnvio);

    return new Response(
      JSON.stringify({ ok: true, sent: promesasEnvio.length }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    console.error("Function 500 Crash:", msg);
    return new Response(msg, { status: 500 });
  }
});
