from datetime import datetime, timezone

from app.services.secretChatAuth.errors import RoomExpiredError
from app.shared.storage.supabase_chat_rooms_client import ChatRoomStorageClient


def is_expired(room: dict) -> bool:
    expires_at = room["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    return datetime.now(timezone.utc) >= expires_at


def purge_room(room_id: str, client: ChatRoomStorageClient) -> None:
    client.delete_room(room_id)


def get_active_room(room_id: str, client: ChatRoomStorageClient) -> dict | None:
    """Busca la sala en secret_chat_rooms. Tres resultados posibles:

    - No hay fila: la sala nunca tuvo contraseña -> devuelve None (quien
      llama debe tratarlo como "sin contraseña", no como error).
    - Hay fila y no vencio: la devuelve, para verificar la contraseña.
    - Hay fila pero vencio: la purga on-demand (sin worker, mismo patron
      que sharedContent/secretVault) y lanza RoomExpiredError - a
      diferencia del caso "nunca tuvo contraseña", esto NO se trata como
      sala abierta: una sala que tuvo proteccion y la perdio por tiempo
      queda inutilizable, no se vuelve publica silenciosamente.
    """
    room = client.get_room(room_id)
    if room is None:
        return None
    if is_expired(room):
        purge_room(room_id, client)
        raise RoomExpiredError(f"La sala '{room_id}' ya no esta disponible.")
    return room
