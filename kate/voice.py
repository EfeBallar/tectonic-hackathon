"""Server-side ElevenLabs calls. The API key stays on the server; browsers only get short-lived credentials."""

from collections.abc import Iterator

import httpx

from kate.config import Settings


class VoiceError(RuntimeError):
    pass


class ElevenLabs:
    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def agent_configured(self) -> bool:
        return bool(self.settings.elevenlabs_api_key and self.settings.elevenlabs_agent_id)

    def _client(self, timeout: httpx.Timeout | float = 10) -> httpx.Client:
        return httpx.Client(
            base_url=self.settings.elevenlabs_api_base,
            headers={"xi-api-key": self.settings.elevenlabs_api_key},
            timeout=timeout,
        )

    def conversation_credentials(self) -> dict:
        """Credentials for one conversation with the private (auth-enabled) agent.

        WebRTC token first (better echo cancellation); the signed WebSocket URL is the fallback
        for networks that block WebRTC.
        """
        params = {"agent_id": self.settings.elevenlabs_agent_id}
        with self._client() as client:
            token = client.get("/v1/convai/conversation/token", params=params)
            signed = client.get("/v1/convai/conversation/get-signed-url", params=params)
        for response in (token, signed):
            if response.status_code != 200:
                raise VoiceError(f"ElevenLabs returned {response.status_code}: {response.text[:200]}")
        return {"conversation_token": token.json()["token"], "signed_url": signed.json()["signed_url"]}

    def speech_stream(self, text: str) -> Iterator[bytes]:
        """MP3 stream of Kate reading a proactive message. Fails before the first byte if ElevenLabs refuses."""
        client = self._client(timeout=httpx.Timeout(30, connect=10))
        request = client.build_request(
            "POST",
            f"/v1/text-to-speech/{self.settings.elevenlabs_voice_id}/stream",
            params={"output_format": "mp3_44100_128"},
            json={"text": text, "model_id": self.settings.elevenlabs_tts_model},
        )
        response = client.send(request, stream=True)
        if response.status_code != 200:
            detail = response.read()[:200]
            response.close()
            client.close()
            raise VoiceError(f"ElevenLabs TTS returned {response.status_code}: {detail!r}")

        def chunks() -> Iterator[bytes]:
            try:
                yield from response.iter_bytes()
            finally:
                response.close()
                client.close()

        return chunks()
