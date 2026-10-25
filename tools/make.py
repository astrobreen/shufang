#!/usr/bin/env python3
"""Full rebuild: annotate texts -> bundle data -> assemble site.   Needs ./vendor (tools/fetch_sources.sh).

  python3 tools/make.py             # everything
  python3 tools/make.py --no-data   # only re-assemble the site from build/dist (fast; for UI changes)
"""
import os, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
run = lambda *a: subprocess.check_call([sys.executable, os.path.join(here, a[0]), *a[1:]], cwd=os.path.dirname(here))
if '--no-data' not in sys.argv:
    if not os.path.isdir(os.path.join(os.path.dirname(here), 'vendor')) and not os.environ.get('SHUFANG_VENDOR'):
        sys.exit('vendor/ not found. Run tools/fetch_sources.sh first.')
    run('annotate.py')
    run('bundle.py')
run('assemble.py')
