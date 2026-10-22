import pandas as pd
from pathlib import Path
for f in Path('Analytics Case Study').glob('*.xlsx'):
 x=pd.ExcelFile(f);print(f.name,x.sheet_names)
