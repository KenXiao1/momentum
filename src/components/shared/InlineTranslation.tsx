import { Fragment, type ReactNode } from 'react';

/** Render translated emphasis without HTML, preserving translator-controlled word order. */
export function InlineTranslation({
  text,
  values,
}: {
  text: string;
  values: Record<string, ReactNode>;
}) {
  return text.split(/(\[\[\w+\]\])/g).map((part, index) => {
    const name = /^\[\[(\w+)\]\]$/.exec(part)?.[1];
    return (
      <Fragment key={index}>
        {name && Object.prototype.hasOwnProperty.call(values, name)
          ? values[name]
          : part}
      </Fragment>
    );
  });
}
