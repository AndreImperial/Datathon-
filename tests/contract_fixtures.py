from artifact_safety import V2_DATASETS,V2_CHARTS,V2_TABLES,V3_DATASETS

def context(): return {"metrics":{"total_opportunities":"10"}}
def v2(): return {"schema_version":2,"meta":{},"datasets":{key:[] for key in V2_DATASETS},"dataset_status":{key:{"status":"unavailable","reason":"fixture"} for key in V2_DATASETS},"chart_data":{key:[] for key in V2_CHARTS},"chart_metadata":[{"chart_id":key,"source_dataset":"channel_pipeline","fields":["value"]} for key in V2_CHARTS],"tables":{key:{"rows":[]} for key in V2_TABLES},"manifest":{"chart_placement_count":24},"context":context()}
def v3():
    datasets={key:[] for key in V3_DATASETS}; datasets["summary"]=[{"opportunities":10}]; datasets["population_reconciliation"]=[{"opportunities":10}]
    return {"schema_version":3,"meta":{"snapshot_id":"fixture"},"datasets":datasets,"dataset_status":{key:{"status":"unavailable","reason":"fixture"} for key in datasets},"presentation":{"slides":[{"id":f"{seq}-{i:02d}","title":"Fixture","speaker_notes":{"do_not_claim":"Fixture"}} for seq,count in [("main",16),("appendix",6)] for i in range(1,count+1)]}}
