from __future__ import annotations

import asyncio
import sys
from typing import Any

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver

if sys.platform == "win32":
    # psycopg's async connection requires SelectorEventLoop on Windows.
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


class _ThreadedPostgresSaver(BaseCheckpointSaver):
    """Async facade for sync psycopg used by Uvicorn's Windows Proactor loop."""

    def __init__(self, saver: Any) -> None:
        super().__init__(serde=saver.serde)
        self._saver = saver

    @property
    def config_specs(self) -> list[Any]:
        return self._saver.config_specs

    async def aget_tuple(self, config: Any) -> Any:
        return await asyncio.to_thread(self._saver.get_tuple, config)

    async def aput(self, config: Any, checkpoint: Any, metadata: Any, new_versions: Any) -> Any:
        return await asyncio.to_thread(self._saver.put, config, checkpoint, metadata, new_versions)

    async def aput_writes(
        self,
        config: Any,
        writes: Any,
        task_id: str,
        task_path: str = "",
    ) -> None:
        await asyncio.to_thread(self._saver.put_writes, config, writes, task_id, task_path)

    async def alist(self, config: Any, **kwargs: Any):
        rows = await asyncio.to_thread(lambda: list(self._saver.list(config, **kwargs)))
        for row in rows:
            yield row

    async def adelete_thread(self, thread_id: str) -> None:
        await asyncio.to_thread(self._saver.delete_thread, thread_id)


class CheckpointRuntime:
    """Use Postgres checkpoints in production and MemorySaver for local tests."""

    def __init__(self, backend: str, database_url: str) -> None:
        self.backend = backend
        self.database_url = database_url
        self.saver: Any = None
        self._context: Any = None
        self._sync_context = False

    async def start(self) -> Any:
        if self.backend != "postgres":
            self.saver = MemorySaver()
            return self.saver
        if sys.platform == "win32" and asyncio.get_running_loop().__class__.__name__.startswith("Proactor"):
            # Uvicorn's Windows subprocess loop is Proactor; psycopg's sync saver
            # is safe there while the async saver is intentionally selector-only.
            from langgraph.checkpoint.postgres import PostgresSaver

            self._context = PostgresSaver.from_conn_string(self.database_url)
            sync_saver = self._context.__enter__()
            sync_saver.setup()
            self.saver = _ThreadedPostgresSaver(sync_saver)
            self._sync_context = True
            return self.saver
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

        self._context = AsyncPostgresSaver.from_conn_string(self.database_url)
        self.saver = await self._context.__aenter__()
        await self.saver.setup()
        return self.saver

    async def close(self) -> None:
        if self._context is not None:
            if self._sync_context:
                self._context.__exit__(None, None, None)
            else:
                await self._context.__aexit__(None, None, None)
            self._context = None
            self._sync_context = False
        self.saver = None
