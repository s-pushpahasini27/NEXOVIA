"""Small Starlette compatibility layer used by the Nexovia API.

Nexovia's handlers use raw request data and return response objects, so they do
not need FastAPI's Pydantic validation runtime.  Keeping this adapter local
preserves the concise route decorators without loading Pydantic Core's native
extension on Windows.
"""

import inspect

from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse, RedirectResponse, Response
from starlette.staticfiles import StaticFiles


class NexoviaApp(Starlette):
    def _route(self, path: str, endpoint, methods: list[str]):
        parameters = inspect.signature(endpoint).parameters

        async def adapted(request):
            args = []
            for parameter in parameters.values():
                if parameter.annotation is Request or parameter.name == "request":
                    args.append(request)
                elif parameter.name in request.path_params:
                    args.append(request.path_params[parameter.name])
                elif parameter.name in request.query_params:
                    args.append(request.query_params[parameter.name])
                elif parameter.default is not inspect.Parameter.empty:
                    args.append(parameter.default)
                else:
                    raise TypeError(f"No value is available for route argument {parameter.name!r}.")
            if inspect.iscoroutinefunction(endpoint):
                result = await endpoint(*args)
            else:
                result = await run_in_threadpool(endpoint, *args)
            return result if isinstance(result, Response) else JSONResponse(result)

        self.add_route(path, adapted, methods=methods)

    def get(self, path: str, **_options):
        def register(endpoint):
            self._route(path, endpoint, ["GET"])
            return endpoint
        return register

    def post(self, path: str, **_options):
        def register(endpoint):
            self._route(path, endpoint, ["POST"])
            return endpoint
        return register

    def exception_handler(self, exception_class):
        def register(handler):
            self.add_exception_handler(exception_class, handler)
            return handler
        return register

    def middleware(self, middleware_type: str):
        if middleware_type != "http":
            raise ValueError("Nexovia only registers HTTP middleware.")

        def register(dispatch):
            self.add_middleware(BaseHTTPMiddleware, dispatch=dispatch)
            return dispatch

        return register
