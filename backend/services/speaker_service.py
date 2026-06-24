import requests


class AzureSpeakerService:
    API_VERSION = "2021-09-05"

    def __init__(self, subscription_key: str, region: str):
        self.subscription_key = subscription_key
        self.region = region

        self.base_url = (
            f"https://{region}.api.cognitive.microsoft.com"
        )

    def _json_headers(self):
        return {
            "Ocp-Apim-Subscription-Key": self.subscription_key,
            "Content-Type": "application/json",
        }

    def _audio_headers(self):
        return {
            "Ocp-Apim-Subscription-Key": self.subscription_key,
            "Content-Type": "audio/wav; codecs=audio/pcm",
        }

    def _raise_error(self, response):
        if response.ok:
            return

        try:
            detail = response.json()
        except Exception:
            detail = response.text

        raise Exception(
            f"Azure Speaker Recognition Error "
            f"({response.status_code}): {detail}"
        )

    # ---------------------------------------------------------
    # PROFILES
    # ---------------------------------------------------------

    def create_profile(self, locale: str = "es-ES"):

        url = (
            f"{self.base_url}"
            f"/speaker-recognition/verification"
            f"/text-independent/profiles"
            f"?api-version={self.API_VERSION}"
        )

        response = requests.post(
            url,
            headers=self._json_headers(),
            json={"locale": locale},
            timeout=60,
        )

        self._raise_error(response)

        return response.json()

    def get_profile(self, profile_id: str):

        url = (
            f"{self.base_url}"
            f"/speaker-recognition/verification"
            f"/text-independent/profiles/{profile_id}"
            f"?api-version={self.API_VERSION}"
        )

        response = requests.get(
            url,
            headers={
                "Ocp-Apim-Subscription-Key": self.subscription_key
            },
            timeout=60,
        )

        self._raise_error(response)

        return response.json()

    def delete_profile(self, profile_id: str):

        url = (
            f"{self.base_url}"
            f"/speaker-recognition/verification"
            f"/text-independent/profiles/{profile_id}"
            f"?api-version={self.API_VERSION}"
        )

        response = requests.delete(
            url,
            headers={
                "Ocp-Apim-Subscription-Key": self.subscription_key
            },
            timeout=60,
        )

        self._raise_error(response)

        return True

    # ---------------------------------------------------------
    # ENROLLMENT
    # ---------------------------------------------------------

    def enroll_profile(
        self,
        profile_id: str,
        wav_path: str,
        ignore_min_length: bool = False,
    ):

        url = (
            f"{self.base_url}"
            f"/speaker-recognition/verification"
            f"/text-independent/profiles/{profile_id}/enrollments"
            f"?api-version={self.API_VERSION}"
            f"&ignoreMinLength={str(ignore_min_length).lower()}"
        )

        with open(wav_path, "rb") as audio:

            response = requests.post(
                url,
                headers=self._audio_headers(),
                data=audio,
                timeout=120,
            )

        self._raise_error(response)

        return response.json()

    # ---------------------------------------------------------
    # VERIFICATION
    # ---------------------------------------------------------

    def verify_profile(
        self,
        profile_id: str,
        wav_path: str,
        ignore_min_length: bool = False,
    ):

        url = (
            f"{self.base_url}"
            f"/speaker-recognition/verification"
            f"/text-independent/profiles/{profile_id}:verify"
            f"?api-version={self.API_VERSION}"
            f"&ignoreMinLength={str(ignore_min_length).lower()}"
        )

        with open(wav_path, "rb") as audio:

            response = requests.post(
                url,
                headers=self._audio_headers(),
                data=audio,
                timeout=120,
            )

        self._raise_error(response)

        return response.json()

    # ---------------------------------------------------------
    # UTILITIES
    # ---------------------------------------------------------

    def get_enrollment_status(self, profile_id: str):

        profile = self.get_profile(profile_id)

        return {
            "profile_id": profile.get("profileId"),
            "locale": profile.get("locale"),
            "enrollment_status": profile.get("enrollmentStatus"),
            "remaining_enrollments_speech_length":
                profile.get("remainingEnrollmentsSpeechLength"),
        }