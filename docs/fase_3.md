| contacts_apos_limpeza | stg_cm | stg_cm_tel_distintos | stg_idd | stg_idd_tel_distintos |
| --------------------- | ------ | -------------------- | ------- | --------------------- |
| 0                     | 498    | 498                  | 656     | 637                   |


| total | ambos | so_cm | so_idd |
| ----- | ----- | ----- | ------ |
| 778   | 328   | 160   | 290    |


| name              | whatsapp      | clickmassa_contact_id | iddas_pessoa_id |
| ----------------- | ------------- | --------------------- | --------------- |
| Ada Riberti       | 5519993682791 | 75638                 | 894558          |
| Adair Lima        | 5516988098089 | 79028                 | 777384          |
| Adriana Batagello | 5519981097098 | 36156                 | 670124          |
| Adriana Marques   | 5517996383818 | 60344                 | 710912          |
| Adriana Scalzilli | 5519995342662 | 24701                 | 636800          |


| total | flagados_ambiguos |
| ----- | ----------------- |
| 826   | 48                |


| total | ambos | so_cm | so_idd | flagados |
| ----- | ----- | ----- | ------ | -------- |
| 826   | 328   | 170   | 328    | 48       |


-- integridade: nenhum clickmassa_contact_id duplicado (a unique garante, mas confirma)
select clickmassa_contact_id, count(*) from contacts
where clickmassa_contact_id is not null group by 1 having count(*) > 1;
Success. No rows returned


| whatsapp      | quantos |
| ------------- | ------- |
| 5519981110593 | 3       |
| 5519995117357 | 3       |
| 5519994975779 | 3       |
| 5519991806488 | 3       |
| 5514981804068 | 3       |
| 5517991816022 | 3       |
| 5519996674446 | 3       |
| 5511958587006 | 3       |
| 5519997858566 | 3       |
| 5519997442622 | 3       |
| 5535988037705 | 2       |
| 5512996788008 | 2       |
| 5519996146357 | 2       |
| 5519992903131 | 2       |
| 5511954878522 | 2       |
| 5511973927489 | 2       |
| 5548992117207 | 2       |
| 5544991368647 | 2       |
| 5519996168246 | 2       |


| origem    | count |
| --------- | ----- |
| importado | 826   |


