-- İmalathane cihaz entegrasyonu: aynı fiziksel makinenin (MAC adresi) birden
-- fazla kayıt olarak oluşmasını önler (eşzamanlı heartbeat isteklerinde yarış
-- durumu riski vardı). Mevcut veride mükerrer/boş MAC olmadığı doğrulandı.
alter table "ProductionDevice"
  add constraint "ProductionDevice_macAddress_key" unique ("macAddress");
