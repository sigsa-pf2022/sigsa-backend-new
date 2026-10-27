import { describeCatalog } from 'src/common/testing/catalog-suite';
import { MedsMeasurementUnitController } from './meds-measurement-unit.controller';
import { MedsMeasurementUnit } from './meds-measurement-unit.entity';
import { MedsMeasurementUnitService } from './meds-measurement-unit.service';

describeCatalog({
  name: 'MedsMeasurementUnitService / MedsMeasurementUnitController',
  entity: MedsMeasurementUnit,
  service: MedsMeasurementUnitService,
  controller: MedsMeasurementUnitController,
  singular: 'MeasurementUnit',
  plural: 'MeasurementUnits',
  duplicateMessage: 'Ya existe una unidad de medida de medicamento con ese nombre',
});
