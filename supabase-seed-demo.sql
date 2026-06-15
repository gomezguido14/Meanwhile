-- --------------------------------------------------------
-- SCRIPT DE CARGA: DEMO FAMILIAR PARA "MIENTRAS TANTO"
-- Ejecuta esto en el SQL Editor de Supabase
-- --------------------------------------------------------

-- 1. Crear Grupos Familiares (Familia Demo)
INSERT INTO family_groups (id, name, slug, color, sort_order, pin_hash)
VALUES 
  ('f1111111-1111-1111-1111-111111111111', 'Los Abuelos', 'los-abuelos-demo', '#9BACA0', 1, '1234'),
  ('f2222222-2222-2222-2222-222222222222', 'Mamá y Papá', 'mama-y-papa-demo', '#C3A58E', 2, '1234'),
  ('f3333333-3333-3333-3333-333333333333', 'Guido y Giu', 'guido-y-giu-demo', '#A5B5BA', 3, '1234'),
  ('f4444444-4444-4444-4444-444444444444', 'Santi', 'santi-demo', '#D4B872', 4, '1234')
ON CONFLICT (id) DO NOTHING;

-- 2. Crear un Número Mensual de prueba (Mes actual)
INSERT INTO monthly_issues (id, slug, title, month, year, issue_number, intro_text, status)
VALUES 
  ('a1111111-1111-1111-1111-111111111111', 'julio-2026', 'Julio 2026', 'Julio', 2026, 1, 'Este mes juntamos cielos, rincones, pequeñas alegrías y cosas que nos hicieron pensar en ustedes.', 'published')
ON CONFLICT (id) DO NOTHING;

-- 3. Crear Topics (Consignas del mes)
INSERT INTO topics (id, monthly_issue_id, title, description, order_index, layout_type)
VALUES 
  ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'El cielo que vi', 'Una foto del cielo que te llamó la atención estos días.', 1, 'grid'),
  ('b2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'Algo rico', 'Esa comida que te hizo feliz esta semana.', 2, 'grid')
ON CONFLICT (id) DO NOTHING;

-- 4. Crear Contribuciones de Prueba (Para mostrar el modo lectura completo)
INSERT INTO contributions (id, monthly_issue_id, topic_id, family_group_id, title, caption, note_style, is_bold)
VALUES 
  -- Topic 1: El cielo que vi
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'Atardecer en casa', 'Tomando mate en el patio, el cielo se puso increíble. Nos acordamos de ustedes.', 'handwritten', false),
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'f3333333-3333-3333-3333-333333333333', 'Camino al trabajo', 'Amanecer congelado pero con colores preciosos desde el tren.', 'classic', true),
  
  -- Topic 2: Algo rico (Dejamos a los abuelos vacíos para que se vea el estado "Empty")
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'f2222222-2222-2222-2222-222222222222', 'Pasta del domingo', 'Amasamos fideos cortados a cuchillo. Quedaron espectaculares.', 'modern', false),
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'f4444444-4444-4444-4444-444444444444', 'Café especial', 'Descubrí una cafetería nueva cerca de la facu. El flat white es un 10.', 'typewriter', false)
ON CONFLICT DO NOTHING;

-- Nota: Para que las fotos se vean reales, necesitarás subir imágenes de prueba 
-- desde la misma app usando los distintos usuarios de la Familia Demo.
