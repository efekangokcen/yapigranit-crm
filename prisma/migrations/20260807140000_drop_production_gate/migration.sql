-- ProductionGate -> ContractItem birleştirmesi (2/2): eski tabloyu kaldır.
-- Veri taşıma bir önceki migration'da yapıldı (20260807130000_gates_to_contract_items).
-- Bundan sonra ölçü/kesim/montaj akışının tek kaynağı ContractItem'dır.

DROP TABLE IF EXISTS "ProductionGate";
