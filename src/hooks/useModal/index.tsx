import { useState, useCallback, useEffect } from "react";
import ReactDOM from "react-dom";

import Modal from "./Modal";

const modalRoot =
  document.getElementById("modal-root") || document.createElement("div");
if (!document.getElementById("modal-root")) {
  modalRoot.id = "modal-root";
  document.body.appendChild(modalRoot);
}

const useModal = () => {
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalNode, setModalNode] = useState(null);
  const [modalContent, setModalContent] = useState(null);
  const [modalTitle, setModalTitle] = useState("");

  const open = useCallback(({ title, content }) => {
    setModalTitle(title);
    setModalContent(content);
    setModalOpen(true);
  }, []);

  const close = useCallback(() => {
    setModalOpen(false);
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      const el = document.createElement("div");
      modalRoot.appendChild(el);
      setModalNode(el);

      return () => {
        modalRoot.removeChild(el);
      };
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (modalNode) {
      ReactDOM.render(
        <Modal title={modalTitle} close={close}>
          {modalContent}
        </Modal>,
        modalNode
      );
    }
  }, [modalNode, modalContent, modalTitle, close]);

  return [{ open, close }];
};

export default useModal;
