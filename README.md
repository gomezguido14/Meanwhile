# Mientras Tanto - Webapp

Esta carpeta está preparada para subir a Vercel como webapp Next.js conectada a Supabase.

## Qué contiene

- `app/`: webapp principal.
- `lib/supabase.ts`: conexión pública a Supabase.
- `public/mt-cover.png`: imagen de portada inicial.
- `package.json`: dependencias de Next.js.

## Seguridad

Esta webapp no incluye claves secretas en el código.

Usa solamente:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

No subir nunca:

```text
SUPABASE_SERVICE_ROLE_KEY
sb_secret_...
```

Los PINs familiares viven hasheados en Supabase.

## Deploy en Vercel

1. Subí el contenido de esta carpeta al repo conectado con Vercel.
2. Vercel debería detectar Next.js automáticamente.
3. Verificá que estén cargadas las variables de entorno.
4. Hacé Redeploy.

Vercel te va a dar un link tipo:

`https://meanwhile-iota.vercel.app`

## Supabase

Esta versión sí usa Supabase:

- lee grupos, temas y contribuciones;
- valida PIN con una función segura;
- sube fotos al bucket `journal-photos`;
- guarda una contribución por grupo y tema.
- permite preparar el próximo número mensual desde la app si el grupo tiene permisos admin;
- permite que el admin defina los temas del mes antes de crearlo.

Además del seed demo, ejecutar estas funciones en el SQL Editor cuando corresponda:

- `supabase-save-family-avatar.sql`
- `supabase-create-next-issue.sql`
