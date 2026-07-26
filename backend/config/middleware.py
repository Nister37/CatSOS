import logging
import re
import time
from uuid import uuid4

from .request_context import request_id_context


logger = logging.getLogger('catsos.request')
REQUEST_ID_PATTERN = re.compile(r'^[A-Za-z0-9._-]{1,64}$')


class RequestIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        supplied_request_id = request.headers.get('X-Request-ID', '')
        request_id = (
            supplied_request_id
            if REQUEST_ID_PATTERN.fullmatch(supplied_request_id)
            else uuid4().hex
        )
        request.request_id = request_id
        token = request_id_context.set(request_id)
        started_at = time.monotonic()
        try:
            response = self.get_response(request)
            response['X-Request-ID'] = request_id
            logger.info(
                'request.completed',
                extra={
                    'event': 'request.completed',
                    'method': request.method,
                    'path': request.path[:500],
                    'status_code': response.status_code,
                    'duration_ms': round((time.monotonic() - started_at) * 1000, 2),
                },
            )
            return response
        finally:
            request_id_context.reset(token)
