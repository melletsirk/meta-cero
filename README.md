# Meta Cero 💸

> Herramienta de seguimiento y gestión de deudas diseñada para la realidad financiera peruana.

**[→ Ver app en producción](https://meta-cero.pages.dev/)**

---

## ¿Para quién es esto?

Meta Cero está pensada para personas que ya están endeudadas — no para prevenirlo, sino para ayudar a salir. Especialmente para quienes:

- Tienen varios préstamos activos (bancos, financieras, personas naturales)
- Han recurrido al "ruleteo": sacar un préstamo nuevo para pagar otro
- Cargan con deudas en nombre propio que en realidad son de un familiar
- Toman decisiones bajo presión y necesitan ver su situación real sin juicios

La app no moraliza. Parte de donde el usuario está, no de donde debería estar.

---

## Funcionalidades principales

- **Registro de deudas** con monto, tasa de interés (TEA/TCEA), frecuencia de pago y estado
- **Simulador de cuotas** con cálculo de mora para pagos atrasados
- **Estrategias de pago** avalanche (mayor interés primero) y snowball (menor deuda primero)
- **Autenticación segura** con Supabase Auth
- **Diseño en español**, adaptado al sistema financiero peruano

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | Vue 3 + Composition API |
| Build tool | Vite |
| Estilos | TailwindCSS |
| Package manager | pnpm |
| Backend / DB | Supabase (PostgreSQL + RLS) |
| Deploy | Cloudflare Pages |

---

## Arquitectura de base de datos

```sql
-- Tabla principal de deudas
deudas (
  id, user_id, nombre, monto_original,
  tasa_tea, frecuencia_pago, fecha_inicio,
  estado, created_at
)

-- Cuotas asociadas a cada deuda
cuotas (
  id, deuda_id, numero_cuota, monto,
  fecha_vencimiento, fecha_pago, estado
)
```

Row Level Security (RLS) habilitado: cada usuario solo accede a sus propios datos.

---

## Correr localmente

```bash
# Clonar el repo
git clone https://github.com/melletsirk/meta-cero.git
cd meta-cero

# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# Iniciar servidor de desarrollo
pnpm dev
```

### Variables de entorno requeridas

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

---

## Contexto del proyecto

Este proyecto nació de observar un patrón real en Perú: muchas personas, especialmente en sectores con acceso limitado al sistema financiero formal, terminan en ciclos de deuda difíciles de rastrear y más difíciles de romper.

Meta Cero nació como un proyecto con la intención de construir algo que resuelva un problema concreto para usuarios reales. Y lleguen a estar libres de deudas, por eso el nombre Meta Cero, la meta es llegar a tener cero deudas.

---

## Estado actual

🚧 En desarrollo activo — versión MVP funcional en producción.

Próximas funcionalidades:
- [ ] Simulador de refinanciamiento
- [ ] Gráficos de progreso de pago
- [ ] Comparador de estrategias avalanche vs snowball
- [ ] Exportar resumen en PDF

---
