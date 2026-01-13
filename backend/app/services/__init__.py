"""Business logic services."""

from app.services.data_loader import (
    get_summary_statistics,
    load_school_data,
    print_summary,
)

__all__ = [
    "get_summary_statistics",
    "load_school_data",
    "print_summary",
]
