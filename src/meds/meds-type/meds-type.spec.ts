import { describeCatalog } from 'src/common/testing/catalog-suite';
import { MedsTypeController } from './meds-type.controller';
import { MedsType } from './meds-type.entity';
import { MedsTypeService } from './meds-type.service';

describeCatalog({
  name: 'MedsTypeService / MedsTypeController',
  entity: MedsType,
  service: MedsTypeService,
  controller: MedsTypeController,
  singular: 'Type',
  plural: 'Types',
  duplicateMessage: 'Ya existe una tipo de medicamento con ese nombre',
  filtersByDescription: true,
});
