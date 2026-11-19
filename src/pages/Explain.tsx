
import { useState } from "react";
import { getMnemonicInfo } from "../analysis/mnemonics";
import {
  analyzeOperand,
  splitOperands,
  type OperandInfo,
} from "../analysis/operands";

export default function Explain() {
  const [input, setInput] = useState("");
  const [instruction, setInstruction] = useState("");
  const [selectedOperand, setSelectedOperand] =
    useState<OperandInfo | null>(null);

  const match = instruction.match(/^([A-Za-z][A-Za-z0-9.]*)\s*(.*)$/);
  const mnemonic = match?.[1] ?? "";
  const operandText = match?.[2] ?? "";

  const info = mnemonic ? getMnemonicInfo(mnemonic) : undefined;
  const operands = operandText ? splitOperands(operandText) : [];

  function handleExplain() {
    const firstLine =
      input.split(/\r?\n/).find((line) => line.trim())?.trim() ?? "";

    setInstruction(firstLine);
    setSelectedOperand(null);
  }

  return (
    <section>
      <h1>ARM64 Instruction Explainer</h1>
      <p>Understand the mnemonic and each operand individually.</p>

      <textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="LDR W8, [X19, #0x200]"
        rows={4}
        style={{ width: "100%", marginBottom: "12px" }}
      />

      <button onClick={handleExplain}>Explain Instruction</button>

      {instruction && (
        <article style={{ marginTop: "24px" }}>
          <h2>Instruction</h2>
          <pre>{instruction}</pre>

          <h3>Mnemonic</h3>
          {info ? (
            <>
              <strong>{info.name} — {info.fullName}</strong>
              <p>{info.explanation}</p>
            </>
          ) : (
            <p>No mnemonic explanation available yet.</p>
          )}

          <h3>Operands — Click to Explore</h3>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              justifyContent: "center",
            }}
          >
            {operands.map((operand, index) => (
              <button
                key={`${operand}-${index}`}
                onClick={() =>
                  setSelectedOperand(analyzeOperand(operand))
                }
                style={{
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
                {operand}
              </button>
            ))}
          </div>

          {selectedOperand && (
            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                border: "1px solid #555",
                borderRadius: "8px",
                textAlign: "left",
              }}
            >
              <h3>{selectedOperand.value}</h3>
              <p><strong>Type:</strong> {selectedOperand.type}</p>
              <p>{selectedOperand.explanation}</p>

              <h4>Detailed Explanation</h4>
              <ul>
                {selectedOperand.details.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            </div>
          )}
        </article>
      )}
    </section>
  );
}
