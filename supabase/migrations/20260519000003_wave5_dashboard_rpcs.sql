-- Wave 5: Dashboard RPC functions
-- NOT: Bu RPC'ler isteğe bağlıdır. Frontend hook client-side hesaplama yapar.
-- Büyük ölçekte (1000+ rezervasyon) performans için deploy edilebilir.

-- 1. KPI summary
CREATE OR REPLACE FUNCTION get_dashboard_kpis(
  p_agency_id UUID,
  p_period TEXT DEFAULT 'week'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interval INTERVAL;
  v_current_start TIMESTAMPTZ;
  v_previous_start TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  v_interval := CASE p_period
    WHEN 'week'  THEN INTERVAL '7 days'
    WHEN 'month' THEN INTERVAL '30 days'
    ELSE INTERVAL '7 days'
  END;
  v_current_start  := NOW() - v_interval;
  v_previous_start := v_current_start - v_interval;

  WITH curr AS (
    SELECT COALESCE(SUM(td.price_adult * r.pax),0) AS rev,
           COUNT(DISTINCT r.id)                       AS regs,
           COUNT(DISTINCT r.phone)                    AS custs
    FROM registrations r
    LEFT JOIN tour_dates td ON td.id = r.tour_date_id
    WHERE r.agency_id = p_agency_id
      AND r.created_at >= v_current_start
      AND r.status != 'CANCELLED'
  ),
  prev AS (
    SELECT COALESCE(SUM(td.price_adult * r.pax),0) AS rev,
           COUNT(DISTINCT r.id)                       AS regs
    FROM registrations r
    LEFT JOIN tour_dates td ON td.id = r.tour_date_id
    WHERE r.agency_id = p_agency_id
      AND r.created_at >= v_previous_start
      AND r.created_at < v_current_start
      AND r.status != 'CANCELLED'
  ),
  spark AS (
    SELECT DATE_TRUNC('day', r.created_at)::DATE AS day,
           COALESCE(SUM(td.price_adult * r.pax),0) AS rev,
           COUNT(DISTINCT r.id)                     AS regs
    FROM registrations r
    LEFT JOIN tour_dates td ON td.id = r.tour_date_id
    WHERE r.agency_id = p_agency_id
      AND r.created_at >= NOW() - INTERVAL '7 days'
      AND r.status != 'CANCELLED'
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'revenue',       jsonb_build_object('current', (SELECT rev FROM curr), 'previous', (SELECT rev FROM prev)),
    'registrations', jsonb_build_object('current', (SELECT regs FROM curr), 'previous', (SELECT regs FROM prev)),
    'customers',     jsonb_build_object('current', (SELECT custs FROM curr), 'previous', 0),
    'sparkline_rev', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', day::TEXT, 'value', rev) ORDER BY day) FROM spark), '[]'),
    'sparkline_reg', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', day::TEXT, 'value', regs) ORDER BY day) FROM spark), '[]')
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_kpis TO authenticated, service_role;

-- 2. Tour performance
CREATE OR REPLACE FUNCTION get_tour_performance(p_agency_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  WITH ts AS (
    SELECT t.id, t.title,
           COUNT(DISTINCT r.id)                        AS regs,
           COALESCE(SUM(td.price_adult * r.pax), 0)   AS rev,
           COALESCE(SUM(td.quota), 0)                  AS cap,
           COALESCE(SUM(r.pax), 0)                     AS booked
    FROM tours t
    LEFT JOIN tour_dates td ON td.tour_id = t.id AND td.departure_date >= CURRENT_DATE
    LEFT JOIN registrations r ON r.tour_date_id = td.id AND r.status != 'CANCELLED'
    WHERE t.agency_id = p_agency_id
    GROUP BY t.id, t.title
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'title', title, 'registrations', regs, 'revenue', rev,
    'fillRate', CASE WHEN cap > 0 THEN ROUND((booked::NUMERIC / cap) * 100, 1) ELSE 0 END,
    'isHot',   CASE WHEN cap > 0 THEN (booked::FLOAT / cap) >= 0.8 ELSE false END
  ) ORDER BY rev DESC) INTO v_result
  FROM ts;

  RETURN COALESCE(v_result, '[]');
END;
$$;

GRANT EXECUTE ON FUNCTION get_tour_performance TO authenticated, service_role;
