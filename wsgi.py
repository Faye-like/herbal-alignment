# -*- coding: utf-8 -*-
"""生产环境入口：容器内由 gunicorn 加载本模块。

app.py 里的 db.init_db() 只在 __main__ 下执行，gunicorn 直接导入 app:app 时不会建表，
因此这里先初始化数据库，再导出 Flask 应用。
"""
import os

import db

db.init_db()

from app import app  # noqa: E402  (必须在 init_db 之后导入)

__all__ = ['app']
