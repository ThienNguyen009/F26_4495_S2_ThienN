import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold

df = pd.read_parquet("data/clean.parquet")

####  1. Hold out 20% as  the test
outer = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
trainval_pos, test_pos = next(outer.split(df, df["target"], groups=df["patient_nbr"]))

df["split"] = "train"
df.iloc[test_pos, df.columns.get_loc("split")] = "test"

### 2. From the remaining 80%, just for hold out a quarter (like = 20% of the total) as validation
trainval = df.iloc[trainval_pos]
inner = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=42)
_, val_pos = next(inner.split(trainval, trainval["target"], groups=trainval["patient_nbr"]))
df.loc[trainval.index[val_pos], "split"] = "val"

print(df.groupby("split")["target"].agg(["size", "mean"]))
df.to_parquet("data/clean_split.parquet", index=False)

