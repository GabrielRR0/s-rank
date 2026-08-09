# services/secretChatMedia

Orquestación de las imágenes/audio que se mandan como mensaje normal (efímero) del chat secreto S-Rank — **no** el Cofre (ver `services/secretVault/README.md` para esa otra ruta). Ver `backend/README.md` sección 15 para el panorama completo.

## Por qué esto rompe (a propósito, y acotado) el diseño Zero-Log del chat

Los mensajes de texto normales nunca tocan este backend — viajan puro cliente-a-cliente por Supabase Realtime Broadcast. Las imágenes/audio son la única excepción deliberada: Supabase Realtime tiene un techo real de tamaño por mensaje (~256KB) que no alcanza para una foto o un audio de calidad razonable. En vez de comprimir agresivamente para que entre igual, se decidió que **todo pase por este backend** (mismo techo ~10MB que ya usa `sharedContent`), manteniendo el cifrado de punta a punta: el navegador cifra los bytes con la clave de la sala (el fragmento de la URL, nunca visto por ningún servidor) antes de subirlos — este servicio jamás ve el contenido real, solo bytes opacos.

## Archivos

- **`secret_chat_media_service.py`**: `create_media_item` (valida `ttl_seconds` contra `ALLOWED_CHAT_MEDIA_TTL_SECONDS` y que `mime_type` sea imagen/audio, sube el ciphertext a Storage, inserta la fila), `get_media_item` (descarga de Storage y lo devuelve codificado en base64url en el mismo shape que ya usa el Cofre — sin límite de copias, ver más abajo).
- **`errors.py`**: `ChatMediaUnavailableError` — no existe o ya expiró. El router la traduce a `410`.
- **`cleanup/expire_on_access.py`**: `is_expired`/`purge_item`/`raise_if_expired`, on-demand, sin worker — mismo patrón que el resto del proyecto. `purge_item` borra el archivo de Storage y la fila juntos.

## Por qué no hay límite de copias (a diferencia del Cofre)

El Cofre existe para que un secreto se consuma un número fijo de veces entre quien sea que lo agarre primero. Una imagen/audio dentro de un mensaje normal es distinto: **todos** los ocupantes conectados a la sala (hasta 6) necesitan poder verlo/escucharlo mientras el mensaje siga vivo en su pantalla — purgar tras la primera lectura dejaría a los demás con una burbuja rota. El único mecanismo de expiración acá es el TTL, igual que el resto de los mensajes de esa sala.
