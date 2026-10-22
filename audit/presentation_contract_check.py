"""Read-only checks of the saved presentation's field bindings and scope."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
contract = json.loads((ROOT / 'frontend/public/dashboard-data-v3.json').read_text(encoding='utf-8'))
settings = {
    'source_coverage': ('source', 'usable_touchpoints'),
    'channel_scorecard': ('channel', 'recorded_won_amount'),
    'channel_trends': ('quarter', 'win_rate'),
    'conversion_decomposition': ('stratum', 'contribution_pp'),
    'creative_bundles': ('bundle', 'ctr'),
    'email_content': ('content_title', 'unique_clickers'),
    'web_content': ('page_group', 'unique_recordings'),
    'attribution_overlap': ('group', 'opportunities'),
    'attribution_model_sensitivity': ('channel', 'attributed_amount'),
    'journey_outcomes': ('sequence', 'resolved'),
    'audience_exclusions': ('stage', 'domains'),
    'audience_priority': ('segment_fit', 'eligible_domains'),
    'experiment_scenarios': ('scenario', 'required_total'),
    'recommendations': ('decision', 'confidence_status'),
}
results = []
for slide in contract['presentation']['slides']:
    refs = slide['chart_refs']
    if not refs:
        continue
    ref = refs[0]
    rows = contract['recommendations'] if ref == 'recommendations' else contract['datasets'][ref]
    name, value = settings.get(ref, ('stage', 'opportunities'))
    rendered = rows[:6]
    results.append({
        'slide': slide['id'], 'dataset': ref,
        'name_key': name, 'value_key': value,
        'missing_names': sum(name not in row for row in rendered),
        'missing_values': sum(value not in row for row in rendered),
        'nonnumeric_values': sum(value in row and not isinstance(row[value], (int, float)) for row in rendered),
        'rendered_rows': len(rendered), 'total_rows': len(rows),
        'ignored_secondary_refs': refs[1:],
        'labels': [row.get(name) for row in rendered],
        'scope_motion': [(row.get('scope'), row.get('business_motion')) for row in rendered] if ref == 'channel_scorecard' else [],
    })
print(json.dumps(results, indent=2))
