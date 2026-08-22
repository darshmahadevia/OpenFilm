import { fireEvent, render, screen } from '@testing-library/react';

import { Button, Dialog, Disclosure, Field, IconButton, Panel, Slider } from './index';

describe('base UI components', () => {
  it('renders a button with its selected visual variant', () => {
    render(
      <Button size="small" variant="primary">
        Import photograph
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Import photograph' })).toHaveClass(
      'button--primary',
    );
    expect(screen.getByRole('button', { name: 'Import photograph' })).toHaveClass('button--small');
  });

  it('gives icon-only actions an accessible name', () => {
    render(
      <IconButton label="Open help">
        <span aria-hidden="true">?</span>
      </IconButton>,
    );

    expect(screen.getByRole('button', { name: 'Open help' })).toBeInTheDocument();
  });

  it('associates fields, hints, and slider values', () => {
    render(
      <Field hint="Choose a source first." id="format" label="Format">
        <select aria-describedby="format-hint" defaultValue="jpeg" id="format">
          <option value="jpeg">JPEG</option>
        </select>
      </Field>,
    );
    render(
      <Slider
        displayValue="0.00"
        id="exposure"
        label="Exposure"
        onChange={() => undefined}
        value={0}
      />,
    );

    expect(screen.getByLabelText('Format')).toHaveValue('jpeg');
    expect(screen.getByText('Choose a source first.')).toBeInTheDocument();
    expect(screen.getByLabelText('Exposure')).toHaveValue('0');
    expect(screen.getByText('0.00')).toBeInTheDocument();
  });

  it('provides a titled panel and closable dialog', () => {
    const onClose = vi.fn();

    render(
      <Panel id="tool" title="Adjustments">
        <p>Control content</p>
      </Panel>,
    );
    render(
      <Dialog onClose={onClose} open title="Help">
        <p>Helpful text</p>
      </Dialog>,
    );

    expect(screen.getByRole('heading', { name: 'Adjustments' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Help' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('provides an accessible native disclosure for secondary controls', () => {
    render(
      <Disclosure description="Open the saved changes." id="history" title="Edit history">
        <button type="button">Undo</button>
      </Disclosure>,
    );

    const details = screen.getByText('Edit history').closest('details');

    expect(details).not.toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: 'Edit history' }));
    expect(details).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });
});
