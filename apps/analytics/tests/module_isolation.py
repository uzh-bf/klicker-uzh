from __future__ import annotations

import sys
from collections.abc import Iterator
from contextlib import contextmanager
from types import ModuleType
from typing import cast

_MISSING = object()


@contextmanager
def preserve_imported_modules(module_names: tuple[str, ...]) -> Iterator[None]:
    """Restore imported modules and their parent-package attributes after a test."""
    previous = {name: sys.modules.get(name, _MISSING) for name in module_names}
    previous_parent_attributes: dict[tuple[str, str], object] = {}
    for name in module_names:
        parent_name, attribute = name.rsplit(".", 1)
        parent = sys.modules.get(parent_name)
        previous_parent_attributes[(parent_name, attribute)] = (
            getattr(parent, attribute, _MISSING) if parent is not None else _MISSING
        )

    try:
        yield
    finally:
        for name, module in previous.items():
            if module is _MISSING:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = cast(ModuleType, module)
        for (parent_name, attribute), value in previous_parent_attributes.items():
            parent = sys.modules.get(parent_name)
            if parent is None:
                continue
            if value is _MISSING:
                if hasattr(parent, attribute):
                    delattr(parent, attribute)
            else:
                setattr(parent, attribute, value)
