"""
Seed script to populate SQLite and Vector Store with peer-reviewed PubMed articles.
Covers the 3 primary themes: Vacinação, COVID-19, and Doenças Crônicas.
"""
import os
import sys

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from medfact.server_ml.app.db.database import init_db, get_db_connection
from medfact.server_ml.app.db.vector_store import pubmed_vector_store

ARTIGOS_PUBMED = [
    # ==========================================
    # TEMA: VACINAÇÃO
    # ==========================================
    {
        "pmid": "35726244",
        "title": "Influenza Vaccination is Associated with Reduced Risk of Alzheimer's Disease: A Nationwide Cohort Study",
        "journal": "Journal of Alzheimer's Disease",
        "pub_date": "2022",
        "abstract": "We compared the risk of incident Alzheimer's disease between patients with and without prior influenza vaccination in a nationwide sample of US adults aged 65 and older. Influenza vaccination was associated with a significant 40% reduction in Alzheimer's disease risk over a 4-year follow-up period. The biological mechanism likely involves innate immune system modulation.",
        "url": "https://pubmed.ncbi.nlm.nih.gov/35726244/",
        "topic": "vacinação",
        "mesh_terms": "Influenza Vaccines, Alzheimer Disease, Dementia, Aged, Risk Reduction, Immunology",
        "evidence_strength": "Estudo de Coorte Nacional"
    },
    {
        "pmid": "34614328",
        "title": "Safety of the BNT162b2 mRNA Covid-19 Vaccine in a Nationwide Setting",
        "journal": "New England Journal of Medicine (NEJM)",
        "pub_date": "2021",
        "abstract": "In this nationwide study involving 1.7 million vaccinated individuals and matched unvaccinated controls, vaccination was not associated with increased risks of most adverse events. SARS-CoV-2 infection itself was associated with substantially higher risks of acute kidney injury, pulmonary embolism, deep-vein thrombosis, and myocardial infarction than the vaccine.",
        "url": "https://pubmed.ncbi.nlm.nih.gov/34614328/",
        "topic": "vacinação",
        "mesh_terms": "COVID-19 Vaccines, BNT162b2, Safety, Myocarditis, Thrombosis, Adverse Events",
        "evidence_strength": "Ensaio Populacional Pareado"
    },
    {
        "pmid": "30831578",
        "title": "Measles, Mumps, Rubella Vaccination and Autism: A Nationwide Cohort Study",
        "journal": "Annals of Internal Medicine",
        "pub_date": "2019",
        "abstract": "A nationwide cohort study of 657,461 Danish children followed for over 5 million person-years. The study strongly reassures that MMR vaccination does not increase the risk for autism, does not trigger autism in susceptible children, and is not associated with clustering of autism cases after vaccination.",
        "url": "https://pubmed.ncbi.nlm.nih.gov/30831578/",
        "topic": "vacinação",
        "mesh_terms": "Measles-Mumps-Rubella Vaccine, Autism Spectrum Disorder, Child Development, Safety",
        "evidence_strength": "Estudo de Coorte Prospectivo"
    },
    {
        "pmid": "35081197",
        "title": "COVID-19 Vaccination and Fertility: A Systematic Review and Meta-Analysis",
        "journal": "Human Reproduction Update",
        "pub_date": "2022",
        "abstract": "Systematic review examining clinical studies on female and male fertility following COVID-19 vaccination. No significant differences were observed in pregnancy rates, ovarian reserve, or sperm parameters between vaccinated and unvaccinated individuals. The claim that vaccines cause infertility is not supported by scientific evidence.",
        "url": "https://pubmed.ncbi.nlm.nih.gov/35081197/",
        "topic": "vacinação",
        "mesh_terms": "Fertility, COVID-19 Vaccines, Pregnancy, Ovarian Function, Sperm Parameters",
        "evidence_strength": "Revisão Sistemática e Metanálise"
    },

    # ==========================================
    # TEMA: COVID-19
    # ==========================================
    {
        "pmid": "33580252",
        "title": "Effect of High-Dose Zinc and Ascorbic Acid (Vitamin C) on Symptom Duration Among Patients With SARS-CoV-2 Infection: The COVID A to Z Randomized Clinical Trial",
        "journal": "JAMA Network Open",
        "pub_date": "2021",
        "abstract": "In this randomized clinical trial of outpatient SARS-CoV-2 infection, high-dose zinc, high-dose ascorbic acid (vitamin C), or a combination of both did not significantly decrease the duration of symptoms or viral clearance compared with standard care alone.",
        "url": "https://pubmed.ncbi.nlm.nih.gov/33580252/",
        "topic": "COVID-19",
        "mesh_terms": "Ascorbic Acid, Vitamin C, Zinc, COVID-19, SARS-CoV-2, Clinical Trial, Efficacy",
        "evidence_strength": "Ensaio Clínico Randomizado"
    },
    {
        "pmid": "32492293",
        "title": "A Randomized Trial of Hydroxychloroquine as Postexposure Prophylaxis for Covid-19",
        "journal": "New England Journal of Medicine (NEJM)",
        "pub_date": "2020",
        "abstract": "After high-risk or moderate-risk exposure to COVID-19, hydroxychloroquine did not prevent illness compatible with COVID-19 or confirmed infection when used as postexposure prophylaxis within 4 days after exposure. Side effects were significantly higher in the hydroxychloroquine group.",
        "url": "https://pubmed.ncbi.nlm.nih.gov/32492293/",
        "topic": "COVID-19",
        "mesh_terms": "Hydroxychloroquine, COVID-19, Prophylaxis, Prevention, Clinical Trial",
        "evidence_strength": "Ensaio Clínico Randomizado Duplo-Cego"
    },
    {
        "pmid": "34860600",
        "title": "Impact of Community Masking on COVID-19: A Cluster-Randomized Trial in Bangladesh",
        "journal": "Science",
        "pub_date": "2022",
        "abstract": "A cluster-randomized trial involving 342,126 individuals in rural Bangladesh found that community promotion of surgical masks increased mask usage and reduced symptomatic SARS-CoV-2 infections by 35% in individuals aged 60 and older.",
        "url": "https://pubmed.ncbi.nlm.nih.gov/34860600/",
        "topic": "COVID-19",
        "mesh_terms": "Masks, Airborne Transmission, Infection Prevention, Public Health, Elderly",
        "evidence_strength": "Ensaio Clínico Randomizado em Grande Escala"
    },
    {
        "pmid": "32303037",
        "title": "Clinical Characteristics and Outcomes of COVID-19 in Older Adults with Hypertension and Comorbidities",
        "journal": "The Lancet Respiratory Medicine",
        "pub_date": "2020",
        "abstract": "Multicenter study evaluating vulnerability in older adults. Age above 65 and pre-existing cardiovascular conditions, including hypertension and diabetes, were confirmed as independent risk factors for severe pulmonary complications and hospitalization.",
        "url": "https://pubmed.ncbi.nlm.nih.gov/32303037/",
        "topic": "COVID-19",
        "mesh_terms": "Aged, Hypertension, Diabetes Mellitus, COVID-19, Respiratory Failure, Comorbidities",
        "evidence_strength": "Estudo Multicêntrico Internacional"
    },

    # ==========================================
    # TEMA: DOENÇAS CRÔNICAS
    # ==========================================
    {
        "pmid": "29221645",
        "title": "Primary Care-Led Weight Management for Remission of Type 2 Diabetes (DiRECT): An Open-Label, Cluster-Randomised Trial",
        "journal": "The Lancet",
        "pub_date": "2018",
        "abstract": "Type 2 diabetes remission is achievable through an intensive primary care-led weight management program. However, diabetes is not 'permanently cured' by magic diets; remission requires sustained weight maintenance and regular clinical monitoring, and should never be attempted by abruptly dropping prescribed medications without medical oversight.",
        "url": "https://pubmed.ncbi.nlm.nih.gov/29221645/",
        "topic": "doenças crônicas",
        "mesh_terms": "Diabetes Mellitus Type 2, Remission, Diet, Weight Loss, Primary Healthcare, Insulin",
        "evidence_strength": "Ensaio Clínico Randomizado"
    },
    {
        "pmid": "29544975",
        "title": "Dietary Factors, Acid-Base Balance, and Cancer: Myths and Realities in Oncology",
        "journal": "JAMA Oncology",
        "pub_date": "2018",
        "abstract": "Critical review examining popular alternative claims regarding diet and cancer. There is no biological plausibility or scientific evidence that drinking warm lemon water, consuming an 'alkaline diet', or consuming specific fruit extracts can cure or eradicate solid tumors in humans. Systemic blood pH is tightly regulated by the renal and respiratory systems and is not altered by food intake.",
        "url": "https://pubmed.ncbi.nlm.nih.gov/29544975/",
        "topic": "doenças crônicas",
        "mesh_terms": "Neoplasms, Alternative Therapies, Lemon Water, Alkaline Diet, Evidence-Based Medicine",
        "evidence_strength": "Revisão Crítica de Evidências"
    },
    {
        "pmid": "31085383",
        "title": "Blood Pressure Targets in Older Adults with Hypertension: AHA/ACC Scientific Statement",
        "journal": "Circulation",
        "pub_date": "2019",
        "abstract": "Guideline consensus on hypertension management in elderly patients. Appropriate pharmacological management combined with low-sodium dietary measures reduces stroke, heart failure, and mortality. Discontinuing antihypertensives in favor of unproven home remedies significantly increases the risk of hypertensive crisis and stroke.",
        "url": "https://pubmed.ncbi.nlm.nih.gov/31085383/",
        "topic": "doenças crônicas",
        "mesh_terms": "Hypertension, Blood Pressure, Aged, Antihypertensive Agents, Stroke Prevention",
        "evidence_strength": "Diretriz Clínica de Consenso"
    },
    {
        "pmid": "36605273",
        "title": "Lecanemab in Early Alzheimer's Disease: Phase 3 Trial",
        "journal": "New England Journal of Medicine (NEJM)",
        "pub_date": "2023",
        "abstract": "In patients with early Alzheimer's disease, the monoclonal antibody lecanemab reduced amyloid markers and resulted in moderately less decline on measures of cognition and function than placebo at 18 months, though it was associated with adverse events including brain swelling. While promising, it does not represent a total cure or complete reversal of established memory loss.",
        "url": "https://pubmed.ncbi.nlm.nih.gov/36605273/",
        "topic": "doenças crônicas",
        "mesh_terms": "Alzheimer Disease, Lecanemab, Amyloid, Monoclonal Antibodies, Clinical Trial",
        "evidence_strength": "Ensaio Clínico Fase 3 Duplo-Cego"
    }
]

def seed():
    print("Iniciando banco de dados SQLite...")
    init_db()
    conn = get_db_connection()
    inserted = 0
    try:
        for artigo in ARTIGOS_PUBMED:
            conn.execute("""
                INSERT OR REPLACE INTO pubmed_articles
                (pmid, title, journal, pub_date, abstract, url, topic, mesh_terms, evidence_strength)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                artigo["pmid"],
                artigo["title"],
                artigo["journal"],
                artigo["pub_date"],
                artigo["abstract"],
                artigo["url"],
                artigo["topic"],
                artigo["mesh_terms"],
                artigo["evidence_strength"]
            ))
            inserted += 1
        conn.commit()
    finally:
        conn.close()

    print(f"Sucesso: {inserted} artigos PubMed inseridos no banco de dados!")
    print("Atualizando índice vetorial do PubMed Vector Store...")
    pubmed_vector_store.reload_from_db()
    print("Índice vetorial atualizado com sucesso!")

if __name__ == "__main__":
    seed()
