import { describeCatalog } from 'src/common/testing/catalog-suite';
import { MedsDrugController } from './meds-drug.controller';
import { MedsDrug } from './meds-drug.entity';
import { MedsDrugService } from './meds-drug.service';

describeCatalog({
  name: 'MedsDrugService / MedsDrugController',
  entity: MedsDrug,
  service: MedsDrugService,
  controller: MedsDrugController,
  singular: 'Drug',
  plural: 'Drugs',
  duplicateMessage: 'Ya existe una forma de medicamento con ese nombre',
});
