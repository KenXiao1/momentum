import { translate } from '../i18n/translate';
import { useI18n } from '../i18n';
import type { ImportUnitsModalProps } from './ImportUnitsModal.types';
import { ImportUnitsModalView } from './import-units-modal/ImportUnitsModalView';
import { useImportUnitsController } from './import-units-modal/useImportUnitsController';

export function ImportUnitsModal(props: ImportUnitsModalProps) {
  const { language, t } = useI18n();
  const controller = useImportUnitsController(props);
  const modeLabel =
    controller.importMode === 'copy'
      ? t('importUnitsModal.copy')
      : t('importUnitsModal.move');
  const selectionSummary = translate(
    language === 'zh' ? 'zh' : 'en',
    'importUnitsModal.controllerSelectedUnitsSizeSelectedModeLabel',
    {
      controllerSelectedUnitsSize: controller.selectedUnits.size,
      modeLabel: modeLabel,
    },
  );

  return (
    <ImportUnitsModalView
      units={controller.importableUnits}
      selectedUnits={controller.selectedUnits}
      searchTerm={controller.searchTerm}
      importMode={controller.importMode}
      language={language}
      selectionSummary={selectionSummary}
      onSearchChange={controller.setSearchTerm}
      onModeChange={controller.setImportMode}
      onToggleUnit={controller.toggleUnit}
      onSubmit={controller.submit}
      onClose={props.onClose}
      t={t}
    />
  );
}
