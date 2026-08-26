# Angel Chan

Chat web en tiempo real con estética retro, acceso por contraseña y comunicación mediante WebSockets.

## Funcionalidades

- Acceso general protegido por contraseña y sesión independiente por pestaña.
- Chat en tiempo real con lista de usuarios, edición y borrado de mensajes propios.
- Panel de administración invisible para moderar mensajes y expulsar usuarios.
- Envío de imágenes de hasta 5 MB.
- Historial activo limitado a 200 eventos.
- Archivado interno automático cuando sale el último participante.
- Modo claro y oscuro.

## Requisitos

- Node.js 20.6 o posterior.
- npm.

## Instalación local

```powershell
npm ci
Copy-Item .env.example .env
```

Edita `.env` y reemplaza las contraseñas de ejemplo. Después ejecuta:

```powershell
npm run check
npm run start:local
```

La aplicación queda disponible en `http://localhost:8080` de forma predeterminada.

## Variables de entorno

| Variable | Descripción | Ejemplo |
| --- | --- | --- |
| `PORT` | Puerto HTTP del servidor | `8080` |
| `NODE_ENV` | Entorno de ejecución | `development` |
| `ADMIN_NICK` | Nombre reservado del administrador | `xergno` |
| `ADMIN_PASS` | Contraseña del administrador | Sin valor predeterminado |
| `GATE_PASS` | Contraseña general de entrada | Sin valor predeterminado |
| `COOKIE_SECURE` | Usa cookies solo por HTTPS | `false` local, `true` en producción HTTPS |

El servidor no arranca si faltan `ADMIN_PASS` o `GATE_PASS`. El archivo `.env` está excluido de Git; solo `.env.example` debe subirse.

En plataformas como Dokploy, que inyectan las variables de entorno, el comando de inicio es `npm start` y no necesita un archivo `.env` dentro del despliegue. Configura el puerto HTTP del servicio como `8080`, salvo que hayas definido otro valor en `PORT`.

## Docker Compose

Después de crear y configurar `.env`:

```bash
docker compose up -d --build
```

Los datos se guardan en el volumen `angel-chat-data`. El contenedor incluye una comprobación de salud sobre `/health` y ejecuta Node como usuario sin privilegios.

## Historial y logs

Mientras hay participantes, el historial activo se mantiene en `data/history.json`. Cuando sale el último participante:

1. Se genera un log privado en `data/logs/` con las fechas de inicio y cierre y la transcripción.
2. Se elimina el historial activo de memoria y de `history.json`.

El directorio `data/` no se incluye en Git ni se expone como contenido estático.

## Seguridad para producción

- Usa contraseñas largas y únicas en `.env`.
- Activa `COOKIE_SECURE=true` únicamente cuando el sitio se sirva mediante HTTPS.
- Coloca la aplicación detrás de un proxy inverso con TLS.
- No subas `.env`, `data/`, logs ni archivos de usuarios al repositorio.

## Publicación en GitHub

El remoto esperado es `https://github.com/vx66/angel-chan.git` y la rama principal es `main`.

```bash
git add .
git commit -m "Prepara Angel Chan para publicación"
git push origin main
```
