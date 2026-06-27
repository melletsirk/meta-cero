import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import webpush from "npm:web-push@3.6.4";

console.log("Edge Function iniciada: notify-vencimientos");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

webpush.setVapidDetails(
  "mailto:soporte@meta-cero.com",
  "BKaK8L3Kq6oQuuJGZBgb9vfXa10AKIraOFf3OQLgV8YK2x69tFYcXrxRZsxbM1OaUPW291aD1hDXaqyUvhGkhQY",
  "ZaxXYM-4jv-ecVCkn8xvBe1_qQ1lieIuYqR-7R3vs1g"
);

async function sendNotifications() {
  console.log("Iniciando sendNotifications...");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase env vars");
    throw new Error("Missing Supabase env vars");
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  console.log("Cliente Supabase creado correctamente");

  const fechaLocal = new Date(new Date().getTime() - 5 * 60 * 60 * 1000);
  const hoyStr = fechaLocal.toISOString().split("T")[0];
  console.log("Buscando cuotas para la fecha:", hoyStr);

  const { data: cuotasVencidas, error } = await supabaseAdmin
    .from("cuotas")
    .select("*, deudas(user_id, nombre)")
    .eq("fecha", hoyStr)
    .is("pago_id", null);

  if (error) {
    console.error("DB Query Error:", error);
    throw new Error("DB Query Error: " + JSON.stringify(error));
  }

  console.log("Cuotas encontradas:", cuotasVencidas?.length || 0);

  if (!cuotasVencidas || cuotasVencidas.length === 0) {
    return { ok: true, sent: 0, msg: "No hay cuotas vencidas hoy" };
  }

  const porUsuario: Record<string, typeof cuotasVencidas> = {};
  cuotasVencidas.forEach((c) => {
    const uid = (c.deudas as any).user_id;
    if (!porUsuario[uid]) porUsuario[uid] = [];
    porUsuario[uid].push(c);
  });

  console.log(`Agrupadas en ${Object.keys(porUsuario).length} usuarios distintos`);
  const promesasEnvio: Promise<unknown>[] = [];

  for (const [userId, cuotas] of Object.entries(porUsuario)) {
    console.log(`Buscando suscripciones para el usuario: ${userId}`);
    const { data: subs, error: subsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (subsError) {
      console.error("Error buscando suscripciones:", subsError);
      continue;
    }

    console.log(`Suscripciones encontradas para ${userId}:`, subs?.length || 0);

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

        console.log("Enviando push a endpoint:", sub.endpoint);
        promesasEnvio.push(
          webpush.sendNotification(pushSubscription, payload).catch(async (err: any) => {
            if (err.statusCode === 410) {
              console.log("Suscripción revocada (410), eliminando ID:", sub.id);
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

  console.log(`Esperando a que terminen ${promesasEnvio.length} promesas de envío de push...`);
  await Promise.all(promesasEnvio);
  console.log("Todas las promesas de push resueltas");
  return { ok: true, sent: promesasEnvio.length, msg: "Push enviados correctamente" };
}

Deno.serve(async (req) => {
  console.log(`Recibida petición HTTP: ${req.method} ${req.url}`);
  try {
    const result = await sendNotifications();
    console.log("Petición procesada exitosamente:", result);
    return new Response(JSON.stringify(result), { 
      headers: { "Content-Type": "application/json" } 
    });
  } catch (err) {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    console.error("Function 500 Crash:", msg);
    return new Response(msg, { status: 500 });
  }
});
