CREATE OR REPLACE VIEW v_train AS
SELECT e.*, p.race, p.gender, d.disposition_group
FROM encounters e
JOIN dim_patient p     ON p.patient_nbr = e.patient_nbr
JOIN dim_disposition d ON d.disposition_id = e.discharge_disposition_id
WHERE e.split = 'train';

/* this is for overall base rate, which is using for asking what's the overall readmission rate */
CREATE OR REPLACE VIEW v_base_rate AS
SELECT COUNT(*) AS n, ROUND(AVG(target)::numeric, 4) AS readmit_rate FROM v_train;


/*  Rate by prior inpatient admissions, I use this for people with more past hospital stays readmitted more like
(0,1,2,3,4+) */
CREATE OR REPLACE VIEW v_rate_by_prior_inpatient AS
SELECT CASE WHEN number_inpatient >= 4 THEN '4+' ELSE number_inpatient::text END AS prior_inpatient,
       COUNT(*) AS n, ROUND(AVG(target)::numeric, 4) AS readmit_rate
FROM v_train GROUP BY 1 ORDER BY 1;

/* Rate by discharge disposition group*/
/* like where do they go after discharge matter like home, care facility...*/
CREATE OR REPLACE VIEW v_rate_by_disposition AS
SELECT disposition_group, COUNT(*) AS n, ROUND(AVG(target)::numeric, 4) AS readmit_rate
FROM v_train GROUP BY 1 ORDER BY readmit_rate DESC;

/*This is for Age, like rating by age*/
CREATE OR REPLACE VIEW v_rate_by_age AS
SELECT age_band, COUNT(*) AS n, ROUND(AVG(target)::numeric, 4) AS readmit_rate
FROM v_train GROUP BY 1 ORDER BY 1;

/*For the length of stay*/
/*Like longer stays mean more readmission*/
CREATE OR REPLACE VIEW v_rate_by_los AS
SELECT time_in_hospital AS los_days, COUNT(*) AS n, ROUND(AVG(target)::numeric, 4) AS readmit_rate
FROM v_train GROUP BY 1 ORDER BY 1;

/* for the number of medications */
/* grouped into ranges 5 its like higher with more medications*/
CREATE OR REPLACE VIEW v_rate_by_meds AS
SELECT width_bucket(num_medications, 0, 40, 8) AS med_bin,
       MIN(num_medications) AS min_meds, MAX(num_medications) AS max_meds,
       COUNT(*) AS n, ROUND(AVG(target)::numeric, 4) AS readmit_rate
FROM v_train GROUP BY 1 ORDER BY 1;


/*Rate by diagnoises, varies by group */
CREATE OR REPLACE VIEW v_rate_by_diag AS
SELECT diag_1_group, COUNT(*) AS n, ROUND(AVG(target)::numeric, 4) AS readmit_rate
FROM v_train GROUP BY 1 ORDER BY readmit_rate DESC;

/*rate by admission type*/
/*  Emergency and elective and urgent */
CREATE OR REPLACE VIEW v_rate_by_admission_type AS
SELECT t.description AS admission_type, COUNT(*) AS n, ROUND(AVG(target)::numeric, 4) AS readmit_rate
FROM v_train v JOIN dim_admission_type t ON t.admission_type_id = v.admission_type_id
GROUP BY 1 ORDER BY readmit_rate DESC;

/*Demographic views for the later fairness section */
CREATE OR REPLACE VIEW v_rate_by_race AS
SELECT race, COUNT(*) AS n, ROUND(AVG(target)::numeric, 4) AS readmit_rate
FROM v_train GROUP BY 1 ORDER BY n DESC;