/**
 * Centralized Error Handling Utility
 * Eliminates duplicate error creation patterns across the codebase
 */

// Error Types
export enum ErrorType {
  AUDIO_CONTEXT = 'AUDIO_CONTEXT_ERROR',
  MEDIA_RECORDER = 'MEDIA_RECORDER_ERROR',
  WASM_MODULE = 'WASM_MODULE_ERROR',
  AUDIO_PROCESSING = 'AUDIO_PROCESSING_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  INITIALIZATION = 'INITIALIZATION_ERROR',
  NETWORK = 'NETWORK_ERROR',
  FILE_SYSTEM = 'FILE_SYSTEM_ERROR',
  PERMISSION = 'PERMISSION_ERROR',
  UNSUPPORTED = 'UNSUPPORTED_ERROR',
}

// Base Error Class
export class MurmurabaError extends Error {
  public readonly type: ErrorType;
  public readonly code: string;
  public readonly details?: Record<string, any>;
  public readonly timestamp: number;

  constructor(
    type: ErrorType,
    message: string,
    code?: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'MurmurabaError';
    this.type = type;
    this.code = code || type;
    this.details = details;
    this.timestamp = Date.now();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MurmurabaError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// Error Factory Class
export class ErrorFactory {
  // Audio Context Errors
  static audioContextNotSupported(details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.AUDIO_CONTEXT,
      'AudioContext is not supported in this browser',
      'AUDIO_CONTEXT_NOT_SUPPORTED',
      details
    );
  }

  static audioContextSuspended(details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.AUDIO_CONTEXT,
      'AudioContext is suspended. User interaction required.',
      'AUDIO_CONTEXT_SUSPENDED',
      details
    );
  }

  static audioContextCreationFailed(originalError?: Error, details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.AUDIO_CONTEXT,
      `Failed to create AudioContext: ${originalError?.message || 'Unknown error'}`,
      'AUDIO_CONTEXT_CREATION_FAILED',
      { ...details, originalError: originalError?.message }
    );
  }

  // Media Recorder Errors
  static mediaRecorderNotSupported(details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.MEDIA_RECORDER,
      'MediaRecorder is not supported in this browser',
      'MEDIA_RECORDER_NOT_SUPPORTED',
      details
    );
  }

  static mediaRecorderStartFailed(originalError?: Error, details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.MEDIA_RECORDER,
      `Failed to start MediaRecorder: ${originalError?.message || 'Unknown error'}`,
      'MEDIA_RECORDER_START_FAILED',
      { ...details, originalError: originalError?.message }
    );
  }

  static mediaRecorderInvalidState(currentState: string, expectedState: string, details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.MEDIA_RECORDER,
      `MediaRecorder is in invalid state. Current: ${currentState}, Expected: ${expectedState}`,
      'MEDIA_RECORDER_INVALID_STATE',
      { ...details, currentState, expectedState }
    );
  }

  // WASM Module Errors
  static wasmModuleNotLoaded(details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.WASM_MODULE,
      'WASM module is not loaded or initialized',
      'WASM_MODULE_NOT_LOADED',
      details
    );
  }

  static wasmModuleLoadFailed(originalError?: Error, details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.WASM_MODULE,
      `Failed to load WASM module: ${originalError?.message || 'Unknown error'}`,
      'WASM_MODULE_LOAD_FAILED',
      { ...details, originalError: originalError?.message }
    );
  }

  static wasmProcessingFailed(originalError?: Error, details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.WASM_MODULE,
      `WASM processing failed: ${originalError?.message || 'Unknown error'}`,
      'WASM_PROCESSING_FAILED',
      { ...details, originalError: originalError?.message }
    );
  }

  // Audio Processing Errors
  static audioProcessingFailed(stage: string, originalError?: Error, details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.AUDIO_PROCESSING,
      `Audio processing failed at stage: ${stage}. ${originalError?.message || 'Unknown error'}`,
      'AUDIO_PROCESSING_FAILED',
      { ...details, stage, originalError: originalError?.message }
    );
  }

  static invalidAudioFormat(expectedFormat: string, receivedFormat: string, details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.AUDIO_PROCESSING,
      `Invalid audio format. Expected: ${expectedFormat}, Received: ${receivedFormat}`,
      'INVALID_AUDIO_FORMAT',
      { ...details, expectedFormat, receivedFormat }
    );
  }

  static audioBufferTooSmall(minSize: number, actualSize: number, details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.AUDIO_PROCESSING,
      `Audio buffer too small. Minimum: ${minSize}, Actual: ${actualSize}`,
      'AUDIO_BUFFER_TOO_SMALL',
      { ...details, minSize, actualSize }
    );
  }

  // Validation Errors
  static invalidParameter(paramName: string, expectedType: string, receivedValue: any, details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.VALIDATION,
      `Invalid parameter '${paramName}'. Expected: ${expectedType}, Received: ${typeof receivedValue}`,
      'INVALID_PARAMETER',
      { ...details, paramName, expectedType, receivedType: typeof receivedValue, receivedValue }
    );
  }

  static parameterOutOfRange(paramName: string, value: number, min: number, max: number, details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.VALIDATION,
      `Parameter '${paramName}' out of range. Value: ${value}, Range: [${min}, ${max}]`,
      'PARAMETER_OUT_OF_RANGE',
      { ...details, paramName, value, min, max }
    );
  }

  static requiredParameterMissing(paramName: string, details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.VALIDATION,
      `Required parameter '${paramName}' is missing`,
      'REQUIRED_PARAMETER_MISSING',
      { ...details, paramName }
    );
  }

  // Initialization Errors
  static initializationFailed(component: string, originalError?: Error, details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.INITIALIZATION,
      `Failed to initialize ${component}: ${originalError?.message || 'Unknown error'}`,
      'INITIALIZATION_FAILED',
      { ...details, component, originalError: originalError?.message }
    );
  }

  static componentAlreadyInitialized(component: string, details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.INITIALIZATION,
      `Component '${component}' is already initialized`,
      'COMPONENT_ALREADY_INITIALIZED',
      { ...details, component }
    );
  }

  // Permission Errors
  static microphonePermissionDenied(details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.PERMISSION,
      'Microphone permission denied by user',
      'MICROPHONE_PERMISSION_DENIED',
      details
    );
  }

  static audioPermissionNotGranted(details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.PERMISSION,
      'Audio permission not granted. User interaction required.',
      'AUDIO_PERMISSION_NOT_GRANTED',
      details
    );
  }

  // Unsupported Feature Errors
  static featureNotSupported(feature: string, details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.UNSUPPORTED,
      `Feature '${feature}' is not supported in this browser`,
      'FEATURE_NOT_SUPPORTED',
      { ...details, feature }
    );
  }

  static browserNotSupported(requiredFeatures: string[], details?: Record<string, any>) {
    return new MurmurabaError(
      ErrorType.UNSUPPORTED,
      `Browser does not support required features: ${requiredFeatures.join(', ')}`,
      'BROWSER_NOT_SUPPORTED',
      { ...details, requiredFeatures }
    );
  }

  // Generic Error Wrapper
  static wrapError(originalError: Error, type: ErrorType, additionalMessage?: string, details?: Record<string, any>) {
    const message = additionalMessage 
      ? `${additionalMessage}: ${originalError.message}`
      : originalError.message;

    const wrappedError = new MurmurabaError(type, message, 'WRAPPED_ERROR', {
      ...details,
      originalError: originalError.message,
      originalStack: originalError.stack,
    });

    // Preserve the original stack trace
    wrappedError.stack = originalError.stack;
    return wrappedError;
  }
}

// Error Handler Class
export class ErrorHandler {
  private static errorCallbacks: Map<ErrorType, ((error: MurmurabaError) => void)[]> = new Map();
  private static globalErrorCallback?: (error: MurmurabaError) => void;

  // Register error callback for specific error type
  static onError(type: ErrorType, callback: (error: MurmurabaError) => void) {
    if (!this.errorCallbacks.has(type)) {
      this.errorCallbacks.set(type, []);
    }
    this.errorCallbacks.get(type)!.push(callback);
  }

  // Register global error callback
  static onAnyError(callback: (error: MurmurabaError) => void) {
    this.globalErrorCallback = callback;
  }

  // Handle error with callbacks
  static handle(error: MurmurabaError) {
    // Call type-specific callbacks
    const typeCallbacks = this.errorCallbacks.get(error.type);
    if (typeCallbacks) {
      typeCallbacks.forEach(callback => {
        try {
          callback(error);
        } catch (callbackError) {
          console.error('Error in error callback:', callbackError);
        }
      });
    }

    // Call global callback
    if (this.globalErrorCallback) {
      try {
        this.globalErrorCallback(error);
      } catch (callbackError) {
        console.error('Error in global error callback:', callbackError);
      }
    }

    return error;
  }

  // Create and handle error in one call
  static create(
    type: ErrorType,
    message: string,
    code?: string,
    details?: Record<string, any>
  ): MurmurabaError {
    const error = new MurmurabaError(type, message, code, details);
    return this.handle(error);
  }

  // Clear all callbacks
  static clearCallbacks() {
    this.errorCallbacks.clear();
    this.globalErrorCallback = undefined;
  }
}

// Utility functions for common error patterns
export const throwIf = (condition: boolean, errorFactory: () => MurmurabaError) => {
  if (condition) {
    throw ErrorHandler.handle(errorFactory());
  }
};

export const throwIfNot = (condition: boolean, errorFactory: () => MurmurabaError) => {
  throwIf(!condition, errorFactory);
};

export const wrapAsync = async <T>(
  asyncFn: () => Promise<T>,
  errorFactory: (error: Error) => MurmurabaError
): Promise<T> => {
  try {
    return await asyncFn();
  } catch (error) {
    throw ErrorHandler.handle(errorFactory(error as Error));
  }
};

export const wrapSync = <T>(
  syncFn: () => T,
  errorFactory: (error: Error) => MurmurabaError
): T => {
  try {
    return syncFn();
  } catch (error) {
    throw ErrorHandler.handle(errorFactory(error as Error));
  }
};

// Export everything
export { MurmurabaError as default };