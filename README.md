# Mientras Tanto - Demo pública

Esta carpeta está preparada para subir a Vercel como demo estática.

## Qué contiene

- `index.html`: prototipo visual y funcional local, sin backend.
- `mt-cover.png`: imagen de portada.
- `vercel.json`: configuración mínima para Vercel.

## Seguridad

Esta demo no incluye contraseñas reales, tokens, claves de Supabase ni variables secretas.

Importante: no uses PINs reales en frontend. Cualquier dato dentro de `index.html` queda visible para quien abra la página.

## Deploy rápido en Vercel

1. Creá un repo nuevo en GitHub, por ejemplo `mientras-tanto-demo`.
2. Subí solamente el contenido de esta carpeta `vercel-demo`.
3. Entrá a Vercel.
4. Elegí `Add New Project`.
5. Importá el repo.
6. En framework, dejá `Other` o `Static`.
7. Deploy.

Vercel te va a dar un link tipo:

`https://mientras-tanto-demo.vercel.app`

## ¿Hace falta Supabase?

Para esta demo pública, no.

Para una versión real donde varias personas suban fotos desde distintos celulares, sí conviene usar Supabase:

- Base de datos para grupos, meses, temas y contribuciones.
- Storage para fotos.
- Reglas de seguridad para que cada grupo edite solo lo suyo.
- PIN validado del lado servidor, no dentro del frontend.

No subas a Vercel una `SUPABASE_SERVICE_ROLE_KEY`. Esa clave nunca debe estar en el navegador.
