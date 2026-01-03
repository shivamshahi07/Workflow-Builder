import logging
import sys
import os
from pathlib import Path
from pythonjsonlogger import jsonlogger
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# Create logs directory
LOGS_DIR = Path("logs")
LOGS_DIR.mkdir(exist_ok=True)


class ColoredFormatter(logging.Formatter):
    """Colored log formatter for console output"""
    
    grey = "\x1b[38;21m"
    blue = "\x1b[38;5;39m"
    yellow = "\x1b[38;5;226m"
    red = "\x1b[38;5;196m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"
    
    FORMATS = {
        logging.DEBUG: grey + "%(asctime)s - %(name)s - %(levelname)s - %(message)s" + reset,
        logging.INFO: blue + "%(asctime)s - %(name)s - %(levelname)s - %(message)s" + reset,
        logging.WARNING: yellow + "%(asctime)s - %(name)s - %(levelname)s - %(message)s" + reset,
        logging.ERROR: red + "%(asctime)s - %(name)s - %(levelname)s - %(message)s" + reset,
        logging.CRITICAL: bold_red + "%(asctime)s - %(name)s - %(levelname)s - %(message)s" + reset,
    }
    
    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = logging.Formatter(log_fmt, datefmt="%Y-%m-%d %H:%M:%S")
        return formatter.format(record)


def setup_logging():
    """Setup comprehensive application logging"""
    
    # Get log level from environment
    log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
    log_level_value = getattr(logging, log_level, logging.INFO)
    
    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level_value)
    root_logger.handlers.clear()
    
    # Console handler with colors (only warnings and errors)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.WARNING)  # Only show warnings and errors in console
    console_handler.setFormatter(ColoredFormatter())
    root_logger.addHandler(console_handler)
    
    # JSON formatter for file logs
    json_formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(funcName)s %(lineno)d %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # Info file handler
    info_handler = logging.FileHandler(LOGS_DIR / "info.log")
    info_handler.setLevel(logging.INFO)
    info_handler.setFormatter(json_formatter)
    root_logger.addHandler(info_handler)
    
    # Error file handler
    error_handler = logging.FileHandler(LOGS_DIR / "error.log")
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(json_formatter)
    root_logger.addHandler(error_handler)
    
    # Debug file handler
    debug_handler = logging.FileHandler(LOGS_DIR / "debug.log")
    debug_handler.setLevel(logging.DEBUG)
    debug_handler.setFormatter(json_formatter)
    root_logger.addHandler(debug_handler)
    
    # Setup specialized loggers
    _setup_database_logger()
    _setup_workflow_logger()
    _setup_api_logger()
    _suppress_noisy_loggers()
    
    logging.info("✅ Logging system initialized successfully")


def _setup_database_logger():
    """Setup database logger - only errors to console, all to file"""
    db_formatter = logging.Formatter(
        "%(asctime)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # SQLAlchemy engine logger - only log errors
    db_logger = logging.getLogger("sqlalchemy.engine")
    db_logger.setLevel(logging.ERROR)  # Only errors
    db_logger.propagate = False
    db_logger.handlers.clear()
    
    # File handler for all DB activity
    db_handler = logging.FileHandler(LOGS_DIR / "db.log")
    db_handler.setLevel(logging.DEBUG)  # Capture everything to file
    db_handler.setFormatter(db_formatter)
    db_logger.addHandler(db_handler)
    
    # Other SQLAlchemy loggers
    for logger_name in ['sqlalchemy.dialects', 'sqlalchemy.pool', 'sqlalchemy.orm']:
        sql_logger = logging.getLogger(logger_name)
        sql_logger.setLevel(logging.ERROR)
        sql_logger.propagate = False
        sql_logger.handlers.clear()
        sql_logger.addHandler(db_handler)


def _setup_workflow_logger():
    """Setup workflow execution logger"""
    json_formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(funcName)s %(lineno)d %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    workflow_logger = logging.getLogger("workflow")
    workflow_logger.setLevel(logging.DEBUG)
    workflow_logger.propagate = False
    workflow_logger.handlers.clear()
    
    # Console handler for workflow (info and above)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(ColoredFormatter())
    workflow_logger.addHandler(console_handler)
    
    # File handler
    workflow_handler = logging.FileHandler(LOGS_DIR / "workflow.log")
    workflow_handler.setLevel(logging.DEBUG)
    workflow_handler.setFormatter(json_formatter)
    workflow_logger.addHandler(workflow_handler)


def _setup_api_logger():
    """Setup API logger"""
    json_formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(funcName)s %(lineno)d %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    api_logger = logging.getLogger("api")
    api_logger.setLevel(logging.INFO)
    api_logger.propagate = False
    api_logger.handlers.clear()
    
    # File handler
    api_handler = logging.FileHandler(LOGS_DIR / "api.log")
    api_handler.setLevel(logging.INFO)
    api_handler.setFormatter(json_formatter)
    api_logger.addHandler(api_handler)


def _suppress_noisy_loggers():
    """Suppress noisy third-party loggers"""
    noisy_loggers = [
        'urllib3',
        'httpx',
        'httpcore',
        'asyncio',
        'multipart',
        'watchfiles',
        'alembic',  # Suppress alembic logs
    ]
    
    for logger_name in noisy_loggers:
        logger = logging.getLogger(logger_name)
        logger.setLevel(logging.ERROR)  # Only show errors
        logger.propagate = False


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance"""
    return logging.getLogger(name)
