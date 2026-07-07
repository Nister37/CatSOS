import sys

from django.core.mail.backends.console import EmailBackend as ConsoleEmailBackend


class ServerLogConsoleEmailBackend(ConsoleEmailBackend):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault('stream', sys.stderr)
        super().__init__(*args, **kwargs)
