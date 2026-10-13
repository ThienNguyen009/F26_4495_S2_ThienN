from ml.features import icd9_group

def test_icd9_groups():
    assert icd9_group("250.83") == "Diabetes"
    assert icd9_group("428") == "Circulatory"
    assert icd9_group("459.9") == "Circulatory"
    assert icd9_group("V57") == "Other"
    assert icd9_group(None) == "Missing"

    