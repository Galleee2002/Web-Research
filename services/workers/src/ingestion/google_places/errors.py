class GoogleApiError(RuntimeError):
    """Base error for Google provider failures."""


class GoogleCredentialsError(GoogleApiError):
    pass


class DailyGoogleRequestLimitExceeded(GoogleApiError):
    pass


class GoogleTimeoutError(GoogleApiError):
    pass


class GoogleRateLimitError(GoogleApiError):
    pass


class GoogleRequestError(GoogleApiError):
    pass


class GoogleInvalidResponseError(GoogleApiError):
    pass


class GoogleGeocodingStatusError(GoogleApiError):
    pass
