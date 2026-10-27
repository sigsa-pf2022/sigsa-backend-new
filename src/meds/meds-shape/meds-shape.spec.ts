import { describeCatalog } from 'src/common/testing/catalog-suite';
import { MedsShapeController } from './meds-shape.controller';
import { MedsShape } from './meds-shape.entity';
import { MedsShapeService } from './meds-shape.service';

describeCatalog({
  name: 'MedsShapeService / MedsShapeController',
  entity: MedsShape,
  service: MedsShapeService,
  controller: MedsShapeController,
  singular: 'Shape',
  plural: 'Shapes',
  duplicateMessage: 'Ya existe una forma de medicamento con ese nombre',
});
