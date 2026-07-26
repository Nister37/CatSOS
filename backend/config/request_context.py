import json
import logging
from contextvars import ContextVar


request_id_context = ContextVar('request_id', default='-')


class RequestContextFilter(logging.Filter):
    def filter(self, record):
        record.request_id = request_id_context.get()
        return True


class JsonFormatter(logging.Formatter):
    """Emit bounded structured logs without serializing request payloads."""

    def format(self, record):
        payload = {
            'timestamp': self.formatTime(record, self.datefmt),
            'level': record.levelname,
            'logger': record.name,
            'event': getattr(record, 'event', record.getMessage()),
            'request_id': getattr(record, 'request_id', request_id_context.get()),
        }
        for field in ('method', 'path', 'status_code', 'duration_ms'):
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        if record.exc_info:
            payload['exception'] = record.exc_info[0].__name__
        return json.dumps(payload, ensure_ascii=False)
