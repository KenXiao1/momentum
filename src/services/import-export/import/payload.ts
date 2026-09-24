import type { ImportTranslator } from './types';
import { isRecord } from '../../../serialization/primitives';

export function parseImportPayload(
  json: string,
  t: ImportTranslator,
): Record<string, unknown> {
  const parsed = JSON.parse(json) as unknown;

  if (!isRecord(parsed)) {
    throw new Error(
      t(
        'importExport.import.payload.invalidImportFormatFileContentIsNotAnObject',
      ),
    );
  }

  return parsed;
}
