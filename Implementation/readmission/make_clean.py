from ml.features import load_raw, filter_rows, add_target, build_features

raw = load_raw()
df = build_features(add_target(filter_rows(raw)))
print(len(raw), "->", len(df), "rows")
print(df["target"].mean())
df.to_parquet("data/clean.parquet", index=False)