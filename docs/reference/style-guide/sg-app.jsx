// sg-app.jsx — mounts the style guide document.

function StyleGuideApp() {
  return (
    <div style={{ background: WT.linen, minHeight: '100vh' }}>
      <SGMasthead/>
      <SGFoundations/>
      {typeof SGButtonsReal  !== 'undefined' ? <SGButtonsReal/>  : <SGButtons/>}
      {typeof SGInputsReal   !== 'undefined' ? <SGInputsReal/>   : <SGInputs/>}
      {typeof SGNavReal      !== 'undefined' ? <SGNavReal/>      : <SGNav/>}
      {typeof SGChatReal     !== 'undefined' ? <SGChatReal/>     : <SGChat/>}
      {typeof SGPlatesReal   !== 'undefined' ? <SGPlatesReal/>   : <SGPlates/>}
      {typeof SGListsReal    !== 'undefined' ? <SGListsReal/>    : <SGLists/>}
      {typeof SGOverlaysReal !== 'undefined' ? <SGOverlaysReal/> : <SGOverlays/>}
      {typeof SGStatesReal   !== 'undefined' ? <SGStatesReal/>   : <SGStates/>}
      {typeof SGComponentStates !== 'undefined' && <SGComponentStates/>}
      {typeof SGLongContent  !== 'undefined' && <SGLongContent/>}
      {typeof SGDark         !== 'undefined' && <SGDark/>}
      {typeof SGA11y         !== 'undefined' && <SGA11y/>}
      {typeof SGDontsReal    !== 'undefined' ? <SGDontsReal/>    : <SGDonts/>}

      <footer style={{
        maxWidth: SG_WIDTH, margin: '0 auto',
        padding: `${WT.sp.xxl}px ${SG_PAD}px ${WT.sp.xxl}px`,
        borderTop: `1px solid ${WT.hairSoft}`,
      }}>
        <Fleuron size={16}/>
        <p style={{
          fontFamily: WT.display, fontStyle: 'italic', fontSize: 16, color: WT.muted,
          margin: `${WT.sp.sm}px 0 0`,
        }}>
          End of volume. Revised by hand as the product grows.
        </p>
      </footer>
    </div>
  );
}

const rootEl = document.getElementById('root');
ReactDOM.createRoot(rootEl).render(<StyleGuideApp/>);
