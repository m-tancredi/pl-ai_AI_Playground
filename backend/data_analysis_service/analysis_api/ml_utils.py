# analysis_api/ml_utils.py
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline # Assicurati sia importato
from sklearn.impute import SimpleImputer
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error, accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

# Algoritmi Scikit-learn
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.svm import SVR, SVC
from sklearn.naive_bayes import GaussianNB


def preprocess_data(df, selected_features, selected_target, task_type):
    """
    Preprocessa il DataFrame per l'addestramento.
    Gestisce missing values, scaling (numeriche), encoding (categoriche).
    Restituisce X, y pronti per il training, e il preprocessor addestrato.
    """
    print(f"Preprocessing data. Features: {selected_features}, Target: {selected_target}, Task: {task_type}")

    X_df = df[selected_features].copy()
    y_series = df[selected_target].copy()

    # Identifica colonne numeriche e categoriche in X
    numeric_features = X_df.select_dtypes(include=np.number).columns.tolist()
    categorical_features = X_df.select_dtypes(include=['object', 'category']).columns.tolist()

    print(f"  Numeric features: {numeric_features}")
    print(f"  Categorical features: {categorical_features}")

    # Pipeline di preprocessing
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='mean')), # Gestisci NaN con la media
        ('scaler', StandardScaler()) # Scala features numeriche
    ])

    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='most_frequent')), # Gestisci NaN con il più frequente
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False)) # One-hot encode
    ])

    # Crea il ColumnTransformer
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features)
        ],
        remainder='passthrough' # Lascia altre colonne (se ce ne fossero) invariate
    )

    # Applica preprocessing a X
    X_processed = preprocessor.fit_transform(X_df)
    print(f"  X data processed. Shape: {X_processed.shape}")

    # Preprocessa y per la classificazione (Label Encoding)
    y_processed = y_series
    label_encoder = None # Per mappare indietro le predizioni
    if task_type == 'classification':
        # Verifica se y è già numerica o necessita encoding
        if y_series.dtype == 'object' or pd.api.types.is_categorical_dtype(y_series):
            label_encoder = LabelEncoder()
            y_processed = label_encoder.fit_transform(y_series)
            print(f"  Target column '{selected_target}' label encoded. Classes: {label_encoder.classes_}")
        elif not pd.api.types.is_numeric_dtype(y_series):
            raise ValueError(f"Target column '{selected_target}' for classification is not numeric or categorical.")
        # Assicurati che le etichette siano intere per la maggior parte dei classificatori
        y_processed = y_processed.astype(int)


    # Gestisci NaN nel target (prima del train/test split)
    if pd.Series(y_processed).isnull().any():
        print(f"  Warning: NaN values found in target column '{selected_target}'. Dropping rows.")
        # Crea un DataFrame temporaneo per allineare e droppare NaN
        temp_df = pd.DataFrame(X_processed)
        temp_df['target'] = y_processed
        temp_df.dropna(subset=['target'], inplace=True)
        if temp_df.empty:
            raise ValueError("All rows dropped due to NaNs in target. Cannot proceed.")
        X_processed = temp_df.drop(columns=['target']).values
        y_processed = temp_df['target'].values
        print(f"  Data shape after dropping NaNs in target: X={X_processed.shape}, y={y_processed.shape}")


    return X_processed, y_processed, preprocessor, label_encoder


# In ml_utils.py -> get_sklearn_model

def get_sklearn_model(algorithm_key, task_type, params=None):
    params = params or {}
    print(f"Initializing model for key: '{algorithm_key}', task: '{task_type}', params: {params}")

    # --- Mappatura per abbreviazioni comuni ---
    key_map = {
        "lr": "linear_regression",
        "LR": "linear_regression",
        "lin_reg": "linear_regression",
        "LinReg": "linear_regression",
        "LIN_REG": "linear_regression",
        "poly_reg": "polynomial_regression",
        "pr": "polynomial_regression",
        "PR": "polynomial_regression",
        "dt_reg": "decision_tree_regressor",
        "dtr": "decision_tree_regressor",
        "DTR": "decision_tree_regressor",
        "rf_reg": "random_forest_regressor",
        "rfr": "random_forest_regressor",
        "RFR": "random_forest_regressor",
        "log_reg": "logistic_regression",
        "dt_clf": "decision_tree_classifier",
        "dtc": "decision_tree_classifier",
        "DTC": "decision_tree_classifier",
        "rf_clf": "random_forest_classifier",
        "rfc": "random_forest_classifier",
        "RFC": "random_forest_classifier",
        "svc": "svc",
        "SVC": "svc",
        "nb_clf": "naive_bayes_classifier",
        "nbc": "naive_bayes_classifier",
        "NB": "naive_bayes_classifier",
        "NBc": "naive_bayes_classifier",
    }
    processed_key = key_map.get(algorithm_key.lower(), algorithm_key.lower())
    print(f"  Processed algorithm key: '{processed_key}'")

    try:
        # Regression Models
        if processed_key == 'linear_regression':
            return LinearRegression(**params)
        elif processed_key == 'polynomial_regression':
            degree = params.get('degree', 2)
            if not isinstance(degree, int) or degree < 2 or degree > 5:
                degree = 2
            return Pipeline([
                ('poly', PolynomialFeatures(degree=degree, include_bias=False)),
                ('linear', LinearRegression())
            ])
        elif processed_key == 'decision_tree_regressor':
            max_depth = params.get('max_depth', 6)
            return DecisionTreeRegressor(random_state=42, max_depth=max_depth, **{k: v for k, v in params.items() if k != 'max_depth'})
        elif processed_key == 'random_forest_regressor':
            n_estimators = params.get('n_estimators', 50)
            max_depth = params.get('max_depth', 8)
            return RandomForestRegressor(random_state=42, n_jobs=-1, n_estimators=n_estimators, max_depth=max_depth, **{k: v for k, v in params.items() if k not in ['n_estimators', 'max_depth']})
        elif processed_key == 'svr':
            kernel = params.get('kernel', 'rbf')
            C = params.get('C', 1.0)
            max_iter = params.get('max_iter', 1000)
            return SVR(kernel=kernel, C=C, max_iter=max_iter, **{k: v for k, v in params.items() if k not in ['kernel', 'C', 'max_iter']})

        # Classification Models
        elif processed_key == 'logistic_regression':
            solver = params.get('solver', 'liblinear')
            max_iter = params.get('max_iter', 300)
            return LogisticRegression(random_state=42, solver=solver, max_iter=max_iter, **{k: v for k, v in params.items() if k not in ['solver', 'max_iter']})
        elif processed_key == 'svc':
            kernel = params.get('kernel', 'rbf')
            probability = params.get('probability', True)
            max_iter = params.get('max_iter', 1000)
            return SVC(random_state=42, kernel=kernel, probability=probability, max_iter=max_iter, **{k: v for k, v in params.items() if k not in ['kernel', 'probability', 'max_iter']})
        elif processed_key == 'decision_tree_classifier':
            max_depth = params.get('max_depth', 6)
            return DecisionTreeClassifier(random_state=42, max_depth=max_depth, **{k: v for k, v in params.items() if k != 'max_depth'})
        elif processed_key == 'random_forest_classifier':
            n_estimators = params.get('n_estimators', 50)
            max_depth = params.get('max_depth', 8)
            return RandomForestClassifier(random_state=42, n_jobs=-1, n_estimators=n_estimators, max_depth=max_depth, **{k: v for k, v in params.items() if k not in ['n_estimators', 'max_depth']})
        elif processed_key == 'naive_bayes_classifier':
            return GaussianNB(**params)
        else:
            raise ValueError(f"Unsupported algorithm_key: '{algorithm_key}' (processed as '{processed_key}')")
    except Exception as e:
        print(f"[get_sklearn_model] Errore nella creazione del modello '{processed_key}': {e}")
        raise

def calculate_regression_metrics(y_true, y_pred):
    return {
        "r2_score": r2_score(y_true, y_pred),
        "mse": mean_squared_error(y_true, y_pred),
        "mae": mean_absolute_error(y_true, y_pred),
        "rmse": np.sqrt(mean_squared_error(y_true, y_pred))
    }

# analysis_api/ml_utils.py

def calculate_classification_metrics(y_true, y_pred, y_pred_proba=None, all_class_labels_numeric=None, all_class_names=None):
    """
    Calcola metriche di classificazione.
    all_class_labels_numeric: Lista di TUTTI gli indici numerici unici possibili per le classi (es. [0, 1, 2]).
    all_class_names: Lista dei nomi di TUTTE le classi, nello stesso ordine degli indici numerici.
    """
    metrics = {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision_macro": precision_score(y_true, y_pred, average='macro', zero_division=0),
        "recall_macro": recall_score(y_true, y_pred, average='macro', zero_division=0),
        "f1_macro": f1_score(y_true, y_pred, average='macro', zero_division=0),
    }

    # Determina le etichette effettive per la confusion matrix
    # Usa all_class_labels_numeric se fornito, altrimenti quelle presenti in y_true e y_pred
    if all_class_labels_numeric is None:
        current_labels = sorted(list(np.unique(np.concatenate((y_true, y_pred)))))
    else:
        current_labels = sorted(list(all_class_labels_numeric))


    if all_class_names and len(all_class_names) == 2 and len(current_labels) >=2 : # Metriche binarie (assicurati che 1 sia la classe positiva)
        # Trova quale etichetta numerica corrisponde alla classe "positiva" (spesso l'indice 1)
        # Questo presuppone che all_class_names[1] sia la classe positiva se y_true/y_pred sono 0 e 1
        positive_label_index = 1 # Assumiamo che 1 sia la classe positiva
        if positive_label_index in current_labels: # Controlla se la classe positiva è presente nei dati
             metrics["precision_binary"] = precision_score(y_true, y_pred, labels=current_labels, pos_label=positive_label_index, average='binary', zero_division=0)
             metrics["recall_binary"] = recall_score(y_true, y_pred, labels=current_labels, pos_label=positive_label_index, average='binary', zero_division=0)
             metrics["f1_binary"] = f1_score(y_true, y_pred, labels=current_labels, pos_label=positive_label_index, average='binary', zero_division=0)


    cm = confusion_matrix(y_true, y_pred, labels=current_labels).tolist()
    metrics["confusion_matrix"] = cm

    # Costruisci confusion_matrix_labels usando all_class_names e current_labels
    # Questo assicura che l'ordine corrisponda a quello della confusion_matrix
    if all_class_names:
        # Mappa gli indici numerici in current_labels ai nomi corrispondenti in all_class_names
        # Solo se l'indice è valido per all_class_names
        metrics["confusion_matrix_labels"] = [all_class_names[i] for i in current_labels if i < len(all_class_names)]
    else: # Fallback se all_class_names non è fornito
        metrics["confusion_matrix_labels"] = [f"Class {i}" for i in current_labels]


    # ROC AUC (richiede y_pred_proba)
    if y_pred_proba is not None and len(all_class_names or []) == 2 and len(current_labels) == 2:
        from sklearn.metrics import roc_auc_score
        try:
            # Assicurati che y_pred_proba sia (n_samples, n_classes)
            # e prendi le probabilità per la classe positiva (indice 1)
            metrics["roc_auc"] = roc_auc_score(y_true, y_pred_proba[:, 1])
        except Exception as roc_exc:
            print(f"Could not calculate ROC AUC: {roc_exc}")
            metrics["roc_auc"] = None

    return metrics
# --- Funzioni per Plot (Esempio con Plotly, da adattare) ---
# Queste funzioni genererebbero JSON per Plotly.js nel frontend


# ... (preprocess_data, get_sklearn_model, calculate_regression_metrics, calculate_classification_metrics come prima) ...

def generate_regression_plot_data(X, y, y_pred, model, feature_names, target_name, X_original=None):
    """
    Genera sempre uno scatter 2D (prima feature vs target), con retta se possibile.
    """
    import numpy as np
    plot_list = []
    # Usa sempre la prima feature per l'asse X
    x_vals = X_original[:, 0] if X_original is not None else X[:, 0]
    plot = {
        "type": "regression_scatter_xy",
        "data": {
            "x": x_vals.tolist(),
            "y_true": y.tolist()
        },
        "layout": {
            "title": f"{feature_names[0]} vs {target_name}",
            "xaxis_title": feature_names[0],
            "yaxis_title": target_name
        }
    }
    # Retta modello (solo per LinearRegression)
    try:
        x_curve = np.linspace(np.min(x_vals), np.max(x_vals), 100)
        if hasattr(model, 'coef_') and hasattr(model, 'intercept_'):
            slope = model.coef_[0] if hasattr(model.coef_, '__getitem__') else model.coef_
            intercept = model.intercept_
            y_curve = slope * x_curve + intercept
            plot["data"]["model_line"] = {"x": x_curve.tolist(), "y": y_curve.tolist()}
        else:
            y_curve = model.predict(x_curve.reshape(-1, 1))
            plot["data"]["model_line"] = {"x": x_curve.tolist(), "y": y_curve.tolist()}
    except Exception as e:
        print(f"Errore nel calcolo della retta: {e}")
    plot_list.append(plot)
    return plot_list

def generate_classification_plot_data(X, y, model, feature_names, target_name, class_names, preprocessor, label_encoder, X_original=None):
    """
    Genera sempre uno scatter 3D (prime 3 feature vs classe predetta). Se ci sono meno di 3 feature, riempi con zeri.
    """
    import numpy as np
    plot_list = []
    n_samples = X.shape[0]
    y_pred = model.predict(X)
    # Prepara le 3 feature (riempi con zeri se mancano)
    if X_original is not None:
        x1 = X_original[:, 0] if X_original.shape[1] > 0 else np.zeros(n_samples)
        x2 = X_original[:, 1] if X_original.shape[1] > 1 else np.zeros(n_samples)
        x3 = X_original[:, 2] if X_original.shape[1] > 2 else np.zeros(n_samples)
    else:
        x1 = X[:, 0] if X.shape[1] > 0 else np.zeros(n_samples)
        x2 = X[:, 1] if X.shape[1] > 1 else np.zeros(n_samples)
        x3 = X[:, 2] if X.shape[1] > 2 else np.zeros(n_samples)
    plot_list.append({
        "type": "classification_scatter_3d",
        "data": {
            "x1": x1.tolist(),
            "x2": x2.tolist(),
            "x3": x3.tolist(),
            "y_pred": y_pred.tolist()
        },
        "layout": {
            "title": f"Scatter 3D: {target_name}",
            "scene": {
                "xaxis": {"title": feature_names[0] if len(feature_names) > 0 else 'X1'},
                "yaxis": {"title": feature_names[1] if len(feature_names) > 1 else 'X2'},
                "zaxis": {"title": feature_names[2] if len(feature_names) > 2 else 'X3'}
            }
        }
    })
    return plot_list

# analysis_api/ml_utils.py
# ... (altri import: pd, np) ...

def analyze_dataframe_for_potential_uses(df, sample_rows_limit=1000, cat_threshold_ratio=0.2, max_cat_sample=10):
    """
    Analizza un DataFrame per estrarre metadati e suggerire potential_uses.
    Restituisce un dizionario di metadati.
    """
    if df is None or df.empty:
        return {
            "num_rows": 0, "num_cols": 0, "headers": [], "column_types": {},
            "potential_uses": [], "sample_rows_preview": []
        }

    # Usa un campione per analisi dettagliata se il DF è grande
    df_sample = df.head(min(len(df), sample_rows_limit))

    metadata = {
        "num_rows": len(df), # Numero righe totali del DF fornito
        "num_cols": len(df.columns),
        "headers": list(df.columns),
        "column_types": {},
        "potential_uses": set(), # Usiamo un set per evitare duplicati
        "sample_rows_preview": df.head(10).to_dict(orient='records') # Preview per UI
    }

    numeric_cols = []
    categorical_cols = []
    datetime_cols = [] # Aggiungiamo per time_series

    for col in df_sample.columns:
        dtype_str = str(df_sample[col].dtype)
        metadata["column_types"][col] = dtype_str

        if pd.api.types.is_numeric_dtype(df_sample[col]):
            numeric_cols.append(col)
        elif pd.api.types.is_datetime64_any_dtype(df_sample[col]): # Controlla per datetime
            datetime_cols.append(col)
        elif pd.api.types.is_string_dtype(df_sample[col]) or pd.api.types.is_object_dtype(df_sample[col]):
            # Considera categorica se ha pochi valori unici rispetto al campione
            unique_vals = df_sample[col].nunique(dropna=False) # dropna=False per contare NaN come categoria
            if len(df_sample) > 0 and (unique_vals / len(df_sample) < cat_threshold_ratio) and unique_vals > 1 : # Deve avere almeno 2 categorie
                categorical_cols.append(col)
                if unique_vals <= max_cat_sample:
                    metadata.setdefault('sample_categories', {})[col] = df_sample[col].dropna().unique().tolist()

    print(f"  DataFrame Analysis - Numeric: {numeric_cols}, Categorical: {categorical_cols}, Datetime: {datetime_cols}")

    # Logica suggerimenti (simile a quella del task del resource manager)
    if len(numeric_cols) >= 2:
        metadata["potential_uses"].add("regression")
        metadata["potential_uses"].add("clustering") # Se ci sono almeno 2 numeriche
    if len(categorical_cols) >= 1 and (len(numeric_cols) >= 1 or len(categorical_cols) > 1): # Target categorico + almeno 1 altra feature
        metadata["potential_uses"].add("classification")
    if len(datetime_cols) >= 1 and len(numeric_cols) >= 1:
        metadata["potential_uses"].add("time_series")

    metadata["potential_uses"] = sorted(list(metadata["potential_uses"]))
    return metadata
    return metadata