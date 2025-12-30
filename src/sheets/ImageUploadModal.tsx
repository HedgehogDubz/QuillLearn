import React, { useState, useRef } from 'react';
import './ImageUploadModal.css';

interface ImageUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImageSelect: (imageData: string) => void;
}

export const ImageUploadModal: React.FC<ImageUploadModalProps> = ({
    isOpen,
    onClose,
    onImageSelect
}) => {
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = event.target?.result as string;
                setPreviewUrl(result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePaste = async () => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                for (const type of item.types) {
                    if (type.startsWith('image/')) {
                        const blob = await item.getType(type);
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            const result = event.target?.result as string;
                            setPreviewUrl(result);
                        };
                        reader.readAsDataURL(blob);
                        return;
                    }
                }
            }
            alert('No image found in clipboard');
        } catch (err) {
            alert('Failed to read clipboard. Please use the file upload instead.');
        }
    };

    const handleConfirm = () => {
        if (previewUrl) {
            onImageSelect(previewUrl);
            setPreviewUrl('');
            onClose();
        }
    };

    const handleCancel = () => {
        setPreviewUrl('');
        onClose();
    };

    return (
        <div className="img_modal_overlay" onClick={handleCancel}>
            <div className="img_modal_content" onClick={(e) => e.stopPropagation()}>
                <div className="img_modal_header">
                    <h3>Add Image</h3>
                    <button className="img_modal_close" onClick={handleCancel}>×</button>
                </div>

                <div className="img_modal_body">
                    {previewUrl ? (
                        <div className="img_preview_container">
                            <img src={previewUrl} alt="Preview" className="img_preview" />
                        </div>
                    ) : (
                        <div className="img_upload_area">
                            <div className="img_upload_icon">📷</div>
                            <p>Upload or paste an image</p>
                        </div>
                    )}

                    <div className="img_modal_actions">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                        <button
                            className="img_btn img_btn_secondary"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            📁 Choose File
                        </button>
                        <button
                            className="img_btn img_btn_secondary"
                            onClick={handlePaste}
                        >
                            📋 Paste from Clipboard
                        </button>
                    </div>
                </div>

                <div className="img_modal_footer">
                    <button className="img_btn img_btn_cancel" onClick={handleCancel}>
                        Cancel
                    </button>
                    <button
                        className="img_btn img_btn_primary"
                        onClick={handleConfirm}
                        disabled={!previewUrl}
                    >
                        Add Image
                    </button>
                </div>
            </div>
        </div>
    );
};

