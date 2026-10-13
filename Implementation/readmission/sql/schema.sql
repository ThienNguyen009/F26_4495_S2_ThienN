
/* 
This part im gonna drop the table, and I created the dim_patient,dim_disposition,dim_admission_type
dim_admission_source, encounters, 
*/

DROP TABLE IF EXISTS encounters, dim_patient, dim_disposition,
                     dim_admission_type, dim_admission_source CASCADE;

CREATE TABLE dim_patient (
    patient_nbr  BIGINT PRIMARY KEY,
    race         TEXT,
    gender       TEXT
);

CREATE TABLE dim_disposition (
    disposition_id    INT PRIMARY KEY,
    description       TEXT,
    disposition_group TEXT
);

CREATE TABLE dim_admission_type (
    admission_type_id INT PRIMARY KEY,
    description       TEXT
);

CREATE TABLE dim_admission_source (
    admission_source_id INT PRIMARY KEY,
    description         TEXT
);

CREATE TABLE encounters (
    encounter_id             BIGINT PRIMARY KEY,
    patient_nbr              BIGINT REFERENCES dim_patient(patient_nbr),
    split                    TEXT NOT NULL,
    age_band                 TEXT,
    age_num                  INT,
    admission_type_id        INT,
    admission_source_id      INT,
    discharge_disposition_id INT REFERENCES dim_disposition(disposition_id),
    time_in_hospital         INT,
    num_lab_procedures       INT,
    num_procedures           INT,
    num_medications          INT,
    number_outpatient        INT,
    number_emergency         INT,
    number_inpatient         INT,
    number_diagnoses         INT,
    diag_1_group             TEXT,
    diag_2_group             TEXT,
    diag_3_group             TEXT,
    a1c_result               TEXT,
    max_glu_serum            TEXT,
    insulin                  TEXT,
    n_diabetes_meds          INT,
    n_med_changes            INT,
    total_prior_visits       INT,
    target                   INT NOT NULL
);

