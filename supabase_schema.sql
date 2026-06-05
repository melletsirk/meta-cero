-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear tabla de deudas
CREATE TABLE public.deudas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('formal', 'informal')),
    entidad TEXT NOT NULL,
    monto_original NUMERIC(12, 2) NOT NULL,
    monto_pendiente NUMERIC(12, 2) NOT NULL,
    tea NUMERIC(5, 2), -- Puede ser nulo para deudas informales
    tasa_mensual NUMERIC(5, 2) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_vencimiento DATE,
    num_cuotas INTEGER NOT NULL,
    cuotas_pagadas INTEGER DEFAULT 0,
    monto_cuota NUMERIC(12, 2),
    dia_vencimiento INTEGER CHECK (dia_vencimiento BETWEEN 1 AND 31),
    tiene_seguro BOOLEAN DEFAULT FALSE,
    monto_seguro NUMERIC(12, 2) DEFAULT 0,
    otros_cargos NUMERIC(12, 2) DEFAULT 0,
    notas TEXT,
    estado TEXT CHECK (estado IN ('activa', 'pausada', 'cerrada')) DEFAULT 'activa',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear tabla de cuotas (cronograma)
CREATE TABLE public.cuotas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    deuda_id UUID REFERENCES public.deudas(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL,
    fecha DATE NOT NULL,
    capital NUMERIC(12, 2) NOT NULL,
    interes NUMERIC(12, 2) NOT NULL,
    seguro NUMERIC(12, 2) DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL,
    saldo_pendiente NUMERIC(12, 2) NOT NULL,
    pagada BOOLEAN DEFAULT FALSE,
    modo TEXT CHECK (modo IN ('manual', 'calculado')) DEFAULT 'calculado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configurar Row Level Security (RLS)
ALTER TABLE public.deudas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuotas ENABLE ROW LEVEL SECURITY;

-- Políticas para deudas (cada usuario ve/edita sus propias deudas)
CREATE POLICY "Los usuarios pueden ver sus propias deudas" 
ON public.deudas FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden insertar sus propias deudas" 
ON public.deudas FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias deudas" 
ON public.deudas FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias deudas" 
ON public.deudas FOR DELETE 
USING (auth.uid() = user_id);

-- Políticas para cuotas (cada usuario ve/edita cuotas de sus propias deudas)
CREATE POLICY "Los usuarios pueden ver cuotas de sus deudas" 
ON public.cuotas FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.deudas 
    WHERE public.deudas.id = public.cuotas.deuda_id 
    AND public.deudas.user_id = auth.uid()
  )
);

CREATE POLICY "Los usuarios pueden insertar cuotas de sus deudas" 
ON public.cuotas FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.deudas 
    WHERE public.deudas.id = public.cuotas.deuda_id 
    AND public.deudas.user_id = auth.uid()
  )
);

CREATE POLICY "Los usuarios pueden actualizar cuotas de sus deudas" 
ON public.cuotas FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.deudas 
    WHERE public.deudas.id = public.cuotas.deuda_id 
    AND public.deudas.user_id = auth.uid()
  )
);

CREATE POLICY "Los usuarios pueden eliminar cuotas de sus deudas" 
ON public.cuotas FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.deudas 
    WHERE public.deudas.id = public.cuotas.deuda_id 
    AND public.deudas.user_id = auth.uid()
  )
);

-- Grant permisos a roles autenticados
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deudas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cuotas TO authenticated;

-- ============================================================
-- MIGRACIÓN v2: Contexto Sistema Financiero Peruano
-- Ejecutar en Supabase SQL Editor si la tabla ya existe
-- ============================================================

-- TCEA (Tasa de Costo Efectivo Anual) — exigida por la SBS
-- Incluye intereses + seguros + comisiones + todos los cargos
ALTER TABLE public.deudas
  ADD COLUMN IF NOT EXISTS tcea NUMERIC(6, 2);

-- Frecuencia de pago (Perú: mensual, quincenal, catorcenal, semanal, cuota única)
ALTER TABLE public.deudas
  ADD COLUMN IF NOT EXISTS frecuencia_pago TEXT
    CHECK (frecuencia_pago IN ('mensual', 'quincenal', 'catorcenal', 'semanal', 'cuota_unica'))
    DEFAULT 'mensual';

-- Moneda por deuda (PEN = Soles, USD = Dólares — hipotecas/empresas)
ALTER TABLE public.deudas
  ADD COLUMN IF NOT EXISTS moneda TEXT
    CHECK (moneda IN ('PEN', 'USD'))
    DEFAULT 'PEN';

-- ============================================================
-- MIGRACIÓN v3: Fecha del Primer Pago (reemplaza dia_vencimiento)
-- ============================================================

-- Fecha exacta del primer pago / vencimiento recurrente
ALTER TABLE public.deudas
  ADD COLUMN IF NOT EXISTS fecha_primer_pago DATE;

-- NOTA: dia_vencimiento INTEGER se mantiene por compatibilidad con datos existentes.
-- Para nuevos registros usar fecha_primer_pago.

-- Actualizar cronograma: marcar cuotas aproximadas (calculadas con TCEA en vez de TEA)
ALTER TABLE public.cuotas
  DROP CONSTRAINT IF EXISTS cuotas_modo_check;
ALTER TABLE public.cuotas
  ADD CONSTRAINT cuotas_modo_check
    CHECK (modo IN ('manual', 'calculado', 'aproximado'));

ALTER TABLE public.deudas 
ADD COLUMN tasa_moratoria NUMERIC(6, 2);